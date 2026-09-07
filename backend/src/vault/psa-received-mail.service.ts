import { Injectable, Logger, OnModuleInit, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { GmailApiClient } from './gmail-api.client';
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
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly submissions: VaultSubmissionService,
    private readonly dataSource: DataSource,
    private readonly gmail: GmailApiClient,
  ) {}

  onModuleInit(): void {
    if (!this.enabled()) {
      this.logger.log(
        'PSA received-mail poll disabled (PSA_RECEIVED_MAIL_ENABLED≠1)',
      );
      return;
    }
    if (!this.gmail.hasCredentials()) {
      this.logger.warn(
        'PSA received-mail ENABLED but GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN incomplete — polls will fail until set',
      );
      return;
    }
    this.logger.log(
      `PSA received-mail poll armed user=${this.gmail.user()} cron=${process.env.PSA_RECEIVED_MAIL_CRON || '*/1 * * * *'} (prefer OAuth scope gmail.modify; publish OAuth app before prod so refresh tokens do not expire every ~7d)`,
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
    const accessToken = await this.gmail.fetchAccessToken();
    const labelId = await this.gmail.ensureLabel(accessToken, PROCESSED_LABEL);
    const listed = await this.gmail.listMessageIds(accessToken, GMAIL_QUERY, {
      max: MAX_MESSAGES_PER_POLL,
      pageSize: PAGE_SIZE,
    });
    if (listed.hitCap) {
      this.logger.warn(
        `PSA received-mail poll hit cap=${MAX_MESSAGES_PER_POLL}; remaining mail will be picked up next run`,
      );
    }
    const messageIds = listed.ids;
    const queued: string[] = [];
    let processed = 0;

    for (const id of messageIds) {
      try {
        const raw = await this.gmail.getMessage(accessToken, id);
        const { subject, from, bodyText } = this.gmail.decodeMessage(raw);
        const parsed = parsePsaReceivedMail({ subject, from, bodyText });
        const decision = decidePsaMailIngest(parsed);

        if (decision === 'skip_label') {
          this.logger.debug(
            `skip messageId=${id} reason=${parsed.reason ?? 'unmatched'}`,
          );
          await this.gmail.markProcessed(accessToken, id, labelId);
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
        await this.gmail.markProcessed(accessToken, id, labelId);
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
    const accessToken = await this.gmail.fetchAccessToken();
    const user = this.gmail.user();
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
    const messageId = await this.gmail.insertRfc822(accessToken, raw);
    this.logger.warn(
      `PSA TEST mail injected messageId=${messageId} cert=${cert} (ops test inject)`,
    );
    const poll = await this.pollOnce();
    return { messageId, cert, poll };
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
}
