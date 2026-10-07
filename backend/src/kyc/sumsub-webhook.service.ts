import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../marketplace/notifications/notifications.service';
import { UserService } from '../user/user.service';
import { verifySumsubWebhookDigestWithSecrets } from './utils/sumsub-auth.util';
import {
  extractSumsubRejectionReason,
  mapSumsubReviewToKycStatus,
  shouldApplyKycTransition,
} from './utils/sumsub-status.util';

@Injectable()
export class SumsubWebhookService {
  private readonly logger = new Logger(SumsubWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UserService,
    private readonly notifications: NotificationsService,
  ) {}

  assertDigest(
    rawBody: Buffer | string,
    digestHeader: string | undefined,
    digestAlgHeader?: string | undefined,
  ): void {
    const webhookSecret = this.config.get<string>('SUMSUB_WEBHOOK_SECRET')?.trim();
    const appSecret = this.config.get<string>('SUMSUB_SECRET_KEY')?.trim();
    if (!webhookSecret && !appSecret) {
      throw new ForbiddenException('SUMSUB_WEBHOOK_SECRET is not configured');
    }
    const ok = verifySumsubWebhookDigestWithSecrets({
      secrets: [webhookSecret, appSecret],
      rawBody,
      digestHeader,
      digestAlgHeader,
    });
    if (!ok) {
      this.logger.warn(
        JSON.stringify({
          msg: 'sumsub_webhook_digest_mismatch',
          digestAlg: digestAlgHeader ?? null,
          hasWebhookSecret: Boolean(webhookSecret),
          hasAppSecret: Boolean(appSecret),
        }),
      );
      throw new UnauthorizedException('Invalid Sumsub webhook digest');
    }
  }

  async handlePayload(body: unknown): Promise<{ ok: true; updated: boolean }> {
    const payload =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)
        : {};

    const externalUserId = String(payload.externalUserId ?? '').trim();
    const applicantId = String(payload.applicantId ?? '').trim();
    const eventType = String(payload.type ?? '').trim();

    let user =
      externalUserId.length > 0
        ? await this.users.findById(externalUserId)
        : null;
    if (!user && applicantId) {
      user = await this.users.findByKycExternalId(applicantId);
    }
    if (!user) {
      this.logger.warn(
        JSON.stringify({
          msg: 'sumsub_webhook_user_not_found',
          eventType,
          externalUserId: externalUserId || null,
          applicantId: applicantId || null,
        }),
      );
      return { ok: true, updated: false };
    }

    const reviewResult =
      payload.reviewResult && typeof payload.reviewResult === 'object'
        ? (payload.reviewResult as Record<string, unknown>)
        : undefined;
    const reviewStatus = String(payload.reviewStatus ?? '').trim();
    const reviewAnswer = String(reviewResult?.reviewAnswer ?? '').trim();

    let nextStatus = mapSumsubReviewToKycStatus(reviewStatus, reviewAnswer);

    if (!nextStatus) {
      if (
        eventType === 'applicantPending' ||
        eventType === 'applicantOnHold' ||
        eventType === 'applicantAwaitingUser' ||
        eventType === 'applicantAwaitingService'
      ) {
        nextStatus = 'pending';
      }
    }

    if (!nextStatus || !shouldApplyKycTransition(user.kycStatus, nextStatus)) {
      return { ok: true, updated: false };
    }

    const reason =
      nextStatus === 'rejected'
        ? extractSumsubRejectionReason(reviewResult)
        : null;

    await this.users.updateKycStatus(user.id, {
      status: nextStatus,
      provider: 'sumsub',
      externalId: applicantId || user.kycExternalId,
      reason,
      payload: {
        source: 'sumsub_webhook',
        type: eventType,
        reviewStatus,
        reviewAnswer: reviewAnswer || null,
      },
    });

    if (nextStatus === 'approved' || nextStatus === 'rejected') {
      void this.notifications
        .notifySellerKycResult({
          userId: user.id,
          approved: nextStatus === 'approved',
          reason,
        })
        .catch((e) => {
          this.logger.warn(
            `notifySellerKycResult failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }

    this.logger.log(
      JSON.stringify({
        msg: 'sumsub_webhook_applied',
        userId: user.id,
        eventType,
        status: nextStatus,
      }),
    );

    return { ok: true, updated: true };
  }
}
