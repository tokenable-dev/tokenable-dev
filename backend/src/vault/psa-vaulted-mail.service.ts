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
import { GmailApiClient } from './gmail-api.client';
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
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly submissions: VaultSubmissionService,
    private readonly mintAdmin: VaultSubmissionAdminMintService,
    private readonly chainConfig: ChainConfigService,
    private readonly dataSource: DataSource,
    private readonly gmail: GmailApiClient,
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
    if (!this.gmail.hasCredentials()) {
      this.logger.warn(
        'PSA vaulted-mail ENABLED but GMAIL_* incomplete — polls will fail until set',
      );
      return;
    }
    this.logger.log(
      `PSA vaulted-mail poll armed user=${this.gmail.user()} cron=${process.env.PSA_VAULTED_MAIL_CRON || process.env.PSA_RECEIVED_MAIL_CRON || '*/1 * * * *'} autoMint=${this.autoMintEnabled()} chain=${this.resolveMintChainId()}`,
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
    const accessToken = await this.gmail.fetchAccessToken();
    const labelId = await this.gmail.ensureLabel(accessToken, PROCESSED_LABEL);
    const listed = await this.gmail.listMessageIds(accessToken, GMAIL_QUERY, {
      max: MAX_MESSAGES_PER_POLL,
      pageSize: PAGE_SIZE,
    });
    const messageIds = listed.ids;
    const queued: string[] = [];
    const minted: string[] = [];
    let processed = 0;

    for (const id of messageIds) {
      try {
        const raw = await this.gmail.getMessage(accessToken, id);
        const { subject, from, bodyText } = this.gmail.decodeMessage(raw);
        const parsed = parsePsaVaultedMail({ subject, from, bodyText });
        const decision = decidePsaVaultedMailIngest(parsed);

        if (decision === 'skip_label') {
          this.logger.debug(
            `vaulted skip messageId=${id} reason=${parsed.reason ?? 'unmatched'}`,
          );
          await this.gmail.markProcessed(accessToken, id, labelId);
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
        await this.gmail.markProcessed(accessToken, id, labelId);
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
    const accessToken = await this.gmail.fetchAccessToken();
    const user = this.gmail.user();
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
    const messageId = await this.gmail.insertRfc822(accessToken, raw);
    this.logger.warn(
      `PSA TEST vaulted mail injected messageId=${messageId} cert=${cert}`,
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
        `PSA vaulted-mail unlock failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
