import {
  Injectable,
  Logger,
  OnModuleInit,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { VaultSubmissionAdminMintService } from '../rwa/admin/vault-submission-admin-mint.service';
import {
  decidePsaVaultedMailIngest,
  parsePsaVaultedMail,
} from './psa-vaulted-mail.parser';
import { VaultSubmissionService } from './vault-submission.service';

const PROCESSED_LABEL = 'tokenable-psa-vaulted-processed';
const GMAIL_QUERY =
  'from:noreply@collectors.com subject:"Items Received at PSA Vault" "now secured in your PSA Vault" -label:tokenable-psa-vaulted-processed';
const MAX_MESSAGES_PER_POLL = 100;
const PAGE_SIZE = 25;
/** Distinct from arrival poll lock (872314501). */
const POLL_ADVISORY_LOCK_KEY = 872314502;

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
 * Polls Gmail for PSA “Items Vaulted / now secured” mail and auto-runs
 * mint-and-deliver for matched psa_reviewing items (PSA → Live).
 *
 * Gate: PSA_VAULTED_MAIL_ENABLED=1 (falls back to PSA_RECEIVED_MAIL_ENABLED).
 * Auto-mint: on by default; PSA_VAULTED_MAIL_AUTO_MINT=0 for queue-only.
 */
@Injectable()
export class PsaVaultedMailService implements OnModuleInit {
  private readonly logger = new Logger(PsaVaultedMailService.name);
  private processedLabelId: string | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly submissions: VaultSubmissionService,
    private readonly mintAdmin: VaultSubmissionAdminMintService,
    private readonly chainConfig: ChainConfigService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    if (!this.enabled()) {
      this.logger.log(
        'PSA vaulted-mail poll disabled (PSA_VAULTED_MAIL_ENABLED≠1)',
      );
      return;
    }
    const explicit = this.config.get<string>('PSA_VAULTED_MAIL_ENABLED')?.trim();
    if (explicit !== '1' && explicit !== 'true') {
      this.logger.warn(
        'PSA_VAULTED_MAIL_ENABLED unset — using PSA_RECEIVED_MAIL_ENABLED fallback. Set PSA_VAULTED_MAIL_ENABLED=1 explicitly.',
      );
    }
    const hasCreds = Boolean(
      this.config.get<string>('GMAIL_CLIENT_ID')?.trim() &&
        this.config.get<string>('GMAIL_CLIENT_SECRET')?.trim() &&
        this.config.get<string>('GMAIL_REFRESH_TOKEN')?.trim(),
    );
    if (!hasCreds) {
      this.logger.warn(
        'PSA vaulted-mail ENABLED but GMAIL_* incomplete — polls will fail until set',
      );
      return;
    }
    this.logger.log(
      `PSA vaulted-mail poll armed user=${this.gmailUser()} cron=${process.env.PSA_VAULTED_MAIL_CRON || process.env.PSA_RECEIVED_MAIL_CRON || '*/1 * * * *'} autoMint=${this.autoMintEnabled()} chain=${this.resolveMintChainId()}`,
    );
  }

  private enabled(): boolean {
    const explicit = this.config.get<string>('PSA_VAULTED_MAIL_ENABLED')?.trim();
    if (explicit === '0' || explicit === 'false') return false;
    if (explicit === '1' || explicit === 'true') return true;
    // Staging convenience: inherit arrival Gmail gate when vaulted flag unset.
    const fallback = this.config.get<string>('PSA_RECEIVED_MAIL_ENABLED');
    return fallback === '1' || fallback === 'true';
  }

  private autoMintEnabled(): boolean {
    const v = this.config.get<string>('PSA_VAULTED_MAIL_AUTO_MINT')?.trim();
    return v !== '0' && v !== 'false';
  }

  private resolveMintChainId(): SupportedChainId {
    const raw = this.config.get<string>('PSA_VAULTED_MAIL_CHAIN_ID')?.trim();
    if (raw) {
      const n = Number(raw);
      if ([11155111, 1, 137].includes(n)) return n as SupportedChainId;
    }
    return this.chainConfig.getDefaultChainId();
  }

  @Cron(
    process.env.PSA_VAULTED_MAIL_CRON ||
      process.env.PSA_RECEIVED_MAIL_CRON ||
      '*/1 * * * *',
  )
  async pollCron(): Promise<void> {
    if (!this.enabled()) return;
    if (this.running) return;
    this.running = true;
    try {
      await this.pollOnce();
    } catch (e) {
      this.logger.error(
        `PSA vaulted-mail poll failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      this.running = false;
    }
  }

  async pollOnce(): Promise<{
    processed: number;
    queued: string[];
    minted: string[];
    skippedLock?: boolean;
  }> {
    const locked = await this.tryAdvisoryLock();
    if (!locked) {
      this.logger.debug('PSA vaulted-mail poll skipped (advisory lock held)');
      return { processed: 0, queued: [], minted: [], skippedLock: true };
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
    minted: string[];
  }> {
    const accessToken = await this.fetchAccessToken();
    const labelId = await this.ensureProcessedLabel(accessToken);
    const messageIds = await this.listCandidateMessageIds(accessToken);
    const queued: string[] = [];
    const minted: string[] = [];
    let processed = 0;

    for (const id of messageIds) {
      try {
        const raw = await this.getMessage(accessToken, id);
        const { subject, from, bodyText } = this.decodeMessage(raw);
        const parsed = parsePsaVaultedMail({ subject, from, bodyText });
        const decision = decidePsaVaultedMailIngest(parsed);

        if (decision === 'skip_label') {
          this.logger.debug(
            `vaulted skip messageId=${id} reason=${parsed.reason ?? 'unmatched'}`,
          );
          await this.markProcessed(accessToken, id, labelId);
          processed += 1;
          continue;
        }

        const ingestNote = parsed.matched
          ? null
          : (parsed.reason ?? 'unmatched');
        const review = await this.submissions.enqueuePsaVaultedReview({
          gmailMessageId: id,
          subject,
          fromAddress: from,
          certs: parsed.certs,
          ingestNote,
        });
        queued.push(review.id);

        if (
          this.autoMintEnabled() &&
          parsed.matched &&
          review.status === 'pending' &&
          !review.ingestNote
        ) {
          const outcome = await this.autoMintReview(review.id);
          if (outcome.minted) minted.push(review.id);
        }

        this.logger.log(
          `PSA vaulted mail queued reviewId=${review.id} messageId=${id} certs=${parsed.certs.join(',') || '(none)'} note=${ingestNote ?? 'ok'}`,
        );
        await this.markProcessed(accessToken, id, labelId);
        processed += 1;
      } catch (e) {
        this.logger.warn(
          `PSA vaulted mail handle failed messageId=${id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return { processed, queued, minted };
  }

  /** Mint all matched mint-queue items for a vaulted review. */
  async autoMintReview(
    reviewId: string,
    via: 'auto' | 'admin' = 'auto',
  ): Promise<{ minted: boolean }> {
    const review = await this.submissions.findPsaVaultedReviewById(reviewId);
    if (!review) return { minted: false };
    if (review.status === 'dismissed') return { minted: false };
    if (review.status === 'minted' && !review.errorSummary) {
      return { minted: true };
    }
    if (review.ingestNote && via === 'auto') return { minted: false };

    const match = await this.submissions.findMintQueueItemsByCerts(
      review.certs ?? [],
    );
    if (match.items.length === 0) {
      this.logger.warn(
        `PSA vaulted mint no mint-queue items reviewId=${reviewId}`,
      );
      if (via === 'admin') {
        await this.submissions.recordPsaVaultedMintOutcome(reviewId, {
          via,
          results: (review.certs ?? []).map((cert) => ({
            cert,
            ok: false,
            error: 'no psa_reviewing mint-queue item',
          })),
        });
      }
      return { minted: false };
    }

    const chainId = this.resolveMintChainId();
    const results: Array<{
      cert: string;
      itemId?: string;
      publicId?: string;
      ok: boolean;
      tokenId?: number;
      error?: string;
    }> = [];

    for (const item of match.items) {
      try {
        const r = await this.mintAdmin.mintAndDeliverItem(
          item.submissionId,
          item.itemId,
          chainId,
        );
        results.push({
          cert: item.cert,
          itemId: item.itemId,
          publicId: item.publicId,
          ok: true,
          tokenId: r.tokenId,
        });
      } catch (e) {
        results.push({
          cert: item.cert,
          itemId: item.itemId,
          publicId: item.publicId,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    for (const cert of match.unmatchedCerts) {
      results.push({
        cert,
        ok: false,
        error: 'no psa_reviewing mint-queue item',
      });
    }

    await this.submissions.recordPsaVaultedMintOutcome(reviewId, {
      via,
      results,
    });
    const anyOk = results.some((r) => r.ok);
    this.logger.log(
      `PSA vaulted mint(${via}) reviewId=${reviewId} ok=${results.filter((r) => r.ok).length}/${results.length}`,
    );
    return { minted: anyOk };
  }

  async injectTestVaultedAndPoll(input: {
    cert: string;
    cardLabel?: string | null;
  }): Promise<{
    messageId: string;
    cert: string;
    poll: {
      processed: number;
      queued: string[];
      minted: string[];
      skippedLock?: boolean;
    };
  }> {
    const gate =
      this.config.get<string>('PSA_VAULTED_MAIL_TEST_INJECT') ??
      this.config.get<string>('PSA_RECEIVED_MAIL_TEST_INJECT');
    if (gate !== '1' && gate !== 'true') {
      throw new ForbiddenException(
        'Test mail inject disabled (set PSA_VAULTED_MAIL_TEST_INJECT=1 or PSA_RECEIVED_MAIL_TEST_INJECT=1)',
      );
    }
    const cert = input.cert.trim();
    if (!/^\d{7,10}$/.test(cert)) {
      throw new BadRequestException('cert must be 7–10 digits');
    }
    const label =
      input.cardLabel?.trim() || 'TOKENABLE TEST CARD PSA 10';
    const accessToken = await this.fetchAccessToken();
    const user = this.gmailUser();
    const raw = [
      'From: PSA Vault <noreply@collectors.com>',
      `To: ${user}`,
      'Subject: Items Received at PSA Vault',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      'PSA',
      'Items Vaulted',
      '',
      'The following items are now secured in your PSA Vault.',
      '',
      `${cert} - ${label}`,
      '',
      "If you don't see everything from your recent submission above, don't worry. You'll receive another email soon when those items are vaulted.",
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
      `PSA TEST vaulted mail injected messageId=${insertJson.id} cert=${cert}`,
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
        `PSA vaulted-mail unlock failed: ${e instanceof Error ? e.message : String(e)}`,
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
      chunks.push(this.stripHtml(this.decodeBase64Url(part.body.data)));
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
