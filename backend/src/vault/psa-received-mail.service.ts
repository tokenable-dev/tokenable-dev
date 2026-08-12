import { Injectable, Logger, OnModuleInit, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import {
  decidePsaMailIngest,
  parsePsaReceivedMail,
} from './psa-received-mail.parser';
import { VaultSubmissionService } from './vault-submission.service';

const PROCESSED_LABEL = 'tokenable-psa-processed';
/** Prefer intake body so vault-confirmation mails are left for the vaulted poller. */
const GMAIL_QUERY =
  'from:noreply@collectors.com subject:"Items Received at PSA Vault" "have been received and securely stored" -label:tokenable-psa-processed';
/** Cap per poll — avoids starving other work on huge backlogs. */
const MAX_MESSAGES_PER_POLL = 200;
const PAGE_SIZE = 25;
/** Postgres session advisory lock — multi-instance cron safety. */
const POLL_ADVISORY_LOCK_KEY = 872314501;

type GmailMessageList = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
};

type GmailMessage = {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
};

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

type GmailLabelList = {
  labels?: { id: string; name: string }[];
};

/**
 * Polls Gmail (tokenable.dev@gmail.com) for PSA Vault “Items Received” mail,
 * enqueues arrival reviews, and auto-confirms matched open packages (Ship→PSA).
 *
 * Gate: PSA_RECEIVED_MAIL_ENABLED=1 plus GMAIL_* OAuth env.
 * Auto-confirm: on by default; set PSA_RECEIVED_MAIL_AUTO_CONFIRM=0 to queue-only.
 */
@Injectable()
export class PsaReceivedMailService implements OnModuleInit {
  private readonly logger = new Logger(PsaReceivedMailService.name);
  private processedLabelId: string | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly submissions: VaultSubmissionService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    if (!this.enabled()) {
      this.logger.log(
        'PSA received-mail poll disabled (PSA_RECEIVED_MAIL_ENABLED≠1)',
      );
      return;
    }
    const hasCreds = Boolean(
      this.config.get<string>('GMAIL_CLIENT_ID')?.trim() &&
        this.config.get<string>('GMAIL_CLIENT_SECRET')?.trim() &&
        this.config.get<string>('GMAIL_REFRESH_TOKEN')?.trim(),
    );
    if (!hasCreds) {
      this.logger.warn(
        'PSA received-mail ENABLED but GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN incomplete — polls will fail until set',
      );
      return;
    }
    this.logger.log(
      `PSA received-mail poll armed user=${this.gmailUser()} cron=${process.env.PSA_RECEIVED_MAIL_CRON || '*/1 * * * *'} (prefer OAuth scope gmail.modify; publish OAuth app before prod so refresh tokens do not expire every ~7d)`,
    );
  }

  private enabled(): boolean {
    const v = this.config.get<string>('PSA_RECEIVED_MAIL_ENABLED');
    return v === '1' || v === 'true';
  }

  @Cron(process.env.PSA_RECEIVED_MAIL_CRON || '*/1 * * * *')
  async pollCron(): Promise<void> {
    if (!this.enabled()) return;
    if (this.running) return;
    this.running = true;
    try {
      await this.pollOnce();
    } catch (e) {
      this.logger.error(
        `PSA received-mail poll failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Exposed for manual/ops dry-run. */
  async pollOnce(): Promise<{
    processed: number;
    queued: string[];
    skippedLock?: boolean;
  }> {
    const locked = await this.tryAdvisoryLock();
    if (!locked) {
      this.logger.debug('PSA received-mail poll skipped (advisory lock held)');
      return { processed: 0, queued: [], skippedLock: true };
    }
    try {
      return await this.pollOnceLocked();
    } finally {
      await this.releaseAdvisoryLock();
    }
  }

  private async pollOnceLocked(): Promise<{
    processed: number;
    queued: string[];
  }> {
    const accessToken = await this.fetchAccessToken();
    const labelId = await this.ensureProcessedLabel(accessToken);
    const messageIds = await this.listCandidateMessageIds(accessToken);
    const queued: string[] = [];
    let processed = 0;

    for (const id of messageIds) {
      try {
        const raw = await this.getMessage(accessToken, id);
        const { subject, from, bodyText } = this.decodeMessage(raw);
        const parsed = parsePsaReceivedMail({ subject, from, bodyText });
        const decision = decidePsaMailIngest(parsed);

        if (decision === 'skip_label') {
          this.logger.debug(
            `skip messageId=${id} reason=${parsed.reason ?? 'unmatched'}`,
          );
          await this.markProcessed(accessToken, id, labelId);
          processed += 1;
          continue;
        }

        const ingestNote = parsed.matched
          ? null
          : (parsed.reason ?? 'unmatched');
        const review = await this.submissions.enqueuePsaArrivalReview({
          gmailMessageId: id,
          subject,
          fromAddress: from,
          certs: parsed.certs,
          ingestNote,
          autoConfirmEligible: parsed.matched,
        });
        const autoTag =
          review.status === 'confirmed' && review.confirmedVia === 'auto'
            ? ' auto-confirmed'
            : '';
        queued.push(review.id);
        this.logger.log(
          `PSA received mail queued reviewId=${review.id} messageId=${id} status=${review.status}${autoTag} certs=${parsed.certs.join(',') || '(none)'} matched=${(review.matchedPublicIds ?? []).join(',') || '(none)'} unmatched=${(review.unmatchedCerts ?? []).join(',') || '(none)'} note=${ingestNote ?? 'ok'}`,
        );
        await this.markProcessed(accessToken, id, labelId);
        processed += 1;
      } catch (e) {
        // Do not label — leave for the next poll retry.
        this.logger.warn(
          `PSA received mail handle failed messageId=${id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return { processed, queued };
  }

  /**
   * Ops/dev: insert a synthetic Items Received message into GMAIL_USER inbox,
   * then run one poll. Gated by PSA_RECEIVED_MAIL_TEST_INJECT=1.
   */
  async injectTestItemsReceivedAndPoll(input: {
    cert: string;
    cardLabel?: string | null;
  }): Promise<{
    messageId: string;
    cert: string;
    poll: { processed: number; queued: string[]; skippedLock?: boolean };
  }> {
    const gate = this.config.get<string>('PSA_RECEIVED_MAIL_TEST_INJECT');
    if (gate !== '1' && gate !== 'true') {
      throw new ForbiddenException(
        'Test mail inject disabled (set PSA_RECEIVED_MAIL_TEST_INJECT=1)',
      );
    }
    const cert = input.cert.trim();
    if (!/^\d{7,10}$/.test(cert)) {
      throw new BadRequestException('cert must be 7–10 digits');
    }
    const label =
      input.cardLabel?.trim() ||
      'TOKENABLE TEST CARD PSA 10';
    const accessToken = await this.fetchAccessToken();
    const user = this.gmailUser();
    const raw = [
      'From: PSA Vault <noreply@collectors.com>',
      `To: ${user}`,
      'Subject: Items Received at PSA Vault',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      'PSA Vault',
      '',
      'Items Vaulted',
      '',
      'Your items have been received and securely stored in your vault.',
      '',
      'Your submission',
      '',
      `${cert} - ${label}`,
      '',
      'Collectors',
    ].join('\r\n');
    const encoded = Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const insertRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(user)}/messages?internalDateSource=dateHeader`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encoded,
          labelIds: ['INBOX', 'UNREAD'],
        }),
      },
    );
    const insertJson = (await insertRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!insertRes.ok || !insertJson.id) {
      throw new Error(
        `Gmail insert failed: ${insertRes.status} ${insertJson.error?.message ?? ''}`.trim(),
      );
    }
    this.logger.warn(
      `PSA TEST mail injected messageId=${insertJson.id} cert=${cert} (ops test inject)`,
    );
    const poll = await this.pollOnce();
    return { messageId: insertJson.id, cert, poll };
  }

  private async tryAdvisoryLock(): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT pg_try_advisory_lock($1) AS ok`,
      [POLL_ADVISORY_LOCK_KEY],
    )) as { ok: boolean }[];
    return Boolean(rows[0]?.ok);
  }

  private async releaseAdvisoryLock(): Promise<void> {
    try {
      await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
        POLL_ADVISORY_LOCK_KEY,
      ]);
    } catch (e) {
      this.logger.warn(
        `PSA received-mail unlock failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const clientId = this.config.get<string>('GMAIL_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GMAIL_CLIENT_SECRET')?.trim();
    const refreshToken = this.config.get<string>('GMAIL_REFRESH_TOKEN')?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN required',
      );
    }
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new Error(`Gmail token refresh failed: ${res.status}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('Gmail token refresh: no access_token');
    return json.access_token;
  }

  private gmailUser(): string {
    return (
      this.config.get<string>('GMAIL_USER')?.trim() ||
      'tokenable.dev@gmail.com'
    );
  }

  private async listCandidateMessageIds(accessToken: string): Promise<string[]> {
    const user = encodeURIComponent(this.gmailUser());
    const q = encodeURIComponent(GMAIL_QUERY);
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < MAX_MESSAGES_PER_POLL) {
      const remaining = MAX_MESSAGES_PER_POLL - ids.length;
      const max = Math.min(PAGE_SIZE, remaining);
      let url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?q=${q}&maxResults=${max}`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Gmail list messages failed: ${res.status}`);
      }
      const json = (await res.json()) as GmailMessageList;
      for (const m of json.messages ?? []) ids.push(m.id);
      if (!json.nextPageToken || !(json.messages?.length)) break;
      pageToken = json.nextPageToken;
    }
    if (ids.length >= MAX_MESSAGES_PER_POLL) {
      this.logger.warn(
        `PSA received-mail poll hit cap=${MAX_MESSAGES_PER_POLL}; remaining mail will be picked up next run`,
      );
    }
    return ids;
  }

  private async getMessage(
    accessToken: string,
    messageId: string,
  ): Promise<GmailMessage> {
    const user = encodeURIComponent(this.gmailUser());
    const url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages/${encodeURIComponent(messageId)}?format=full`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Gmail get message failed: ${res.status}`);
    }
    return (await res.json()) as GmailMessage;
  }

  private async ensureProcessedLabel(accessToken: string): Promise<string> {
    if (this.processedLabelId) return this.processedLabelId;
    const user = encodeURIComponent(this.gmailUser());
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${user}/labels`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      throw new Error(`Gmail list labels failed: ${listRes.status}`);
    }
    const list = (await listRes.json()) as GmailLabelList;
    const existing = (list.labels ?? []).find((l) => l.name === PROCESSED_LABEL);
    if (existing?.id) {
      this.processedLabelId = existing.id;
      return existing.id;
    }
    const createRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${user}/labels`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: PROCESSED_LABEL,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        }),
      },
    );
    if (!createRes.ok) {
      throw new Error(`Gmail create label failed: ${createRes.status}`);
    }
    const created = (await createRes.json()) as { id: string };
    this.processedLabelId = created.id;
    return created.id;
  }

  private async markProcessed(
    accessToken: string,
    messageId: string,
    labelId: string,
  ): Promise<void> {
    const user = encodeURIComponent(this.gmailUser());
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${user}/messages/${encodeURIComponent(messageId)}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: [labelId],
          removeLabelIds: ['UNREAD'],
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Gmail modify message failed: ${res.status}`);
    }
  }

  private decodeMessage(msg: GmailMessage): {
    subject: string;
    from: string;
    bodyText: string;
  } {
    const headers = msg.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
    const from =
      headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
    const bodyText = this.collectText(msg.payload);
    return { subject, from, bodyText };
  }

  private collectText(part?: GmailMessagePart | GmailMessage['payload']): string {
    if (!part) return '';
    const chunks: string[] = [];
    if (part.mimeType === 'text/plain' && part.body?.data) {
      chunks.push(this.decodeBase64Url(part.body.data));
    }
    if (part.mimeType === 'text/html' && part.body?.data && chunks.length === 0) {
      chunks.push(
        this.stripHtml(this.decodeBase64Url(part.body.data)),
      );
    }
    for (const child of part.parts ?? []) {
      chunks.push(this.collectText(child));
    }
    return chunks.join('\n');
  }

  private decodeBase64Url(data: string): string {
    const padded = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}
