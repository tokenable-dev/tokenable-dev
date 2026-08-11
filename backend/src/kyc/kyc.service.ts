import { Injectable, Logger } from '@nestjs/common';
import { isWalletOnlyPlaceholderEmail } from '../auth/privy/privy-user.parser';
import type { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  assertKycApprovedForCustody,
  assertKycApprovedFromDb,
} from './utils/kyc-gate.util';
import {
  extractSumsubRejectionReason,
  parseSumsubApplicant,
  resolveKycStatusFromSumsubApplicant,
  shouldApplyReconcileTransition,
} from './utils/sumsub-status.util';
import { SumsubApiService } from './sumsub-api.service';

/** Real inbox email only — never send `@privy.wallet` placeholders to Sumsub. */
export function sumsubEmailForUser(email: string | null | undefined): string | undefined {
  const trimmed = email?.trim();
  if (!trimmed || isWalletOnlyPlaceholderEmail(trimmed)) return undefined;
  return trimmed;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly users: UserService,
    private readonly sumsub: SumsubApiService,
  ) {}

  /**
   * Sync `users.kyc_status` from the **current** Sumsub app (by `externalUserId`).
   * Clears stale approvals when the applicant no longer exists in this app.
   */
  async reconcileUser(user: User): Promise<User> {
    if (!this.sumsub.isConfigured()) return user;

    try {
      const raw = await this.sumsub.fetchApplicantByExternalUserId(user.id);
      if (!raw) {
        if (user.kycStatus === 'none' && !user.kycExternalId) return user;
        if (!shouldApplyReconcileTransition(user.kycStatus, 'none')) {
          return user;
        }
        return this.users.updateKycStatus(user.id, {
          status: 'none',
          provider: 'sumsub',
          externalId: null,
          payload: {
            source: 'sumsub_reconcile',
            reason: 'applicant_not_found',
          },
        });
      }

      const snapshot = parseSumsubApplicant(raw);
      if (!snapshot) return user;

      const nextStatus = resolveKycStatusFromSumsubApplicant(snapshot);
      const review =
        raw.review && typeof raw.review === 'object'
          ? (raw.review as Record<string, unknown>)
          : undefined;
      const reviewResult =
        review?.reviewResult && typeof review.reviewResult === 'object'
          ? (review.reviewResult as Record<string, unknown>)
          : undefined;
      const reason =
        nextStatus === 'rejected'
          ? extractSumsubRejectionReason(reviewResult)
          : null;

      const statusUnchanged = user.kycStatus === nextStatus;
      const externalIdUnchanged = user.kycExternalId === snapshot.id;
      if (statusUnchanged && externalIdUnchanged) return user;

      if (
        !statusUnchanged &&
        !shouldApplyReconcileTransition(user.kycStatus, nextStatus)
      ) {
        if (!externalIdUnchanged) {
          return this.users.updateKycStatus(user.id, {
            status: user.kycStatus,
            provider: 'sumsub',
            externalId: snapshot.id,
            payload: { source: 'sumsub_reconcile', externalIdOnly: true },
          });
        }
        return user;
      }

      return this.users.updateKycStatus(user.id, {
        status: nextStatus,
        provider: 'sumsub',
        externalId: snapshot.id,
        reason,
        payload: {
          source: 'sumsub_reconcile',
          reviewStatus: snapshot.reviewStatus,
          reviewAnswer: snapshot.reviewAnswer || null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Sumsub KYC reconcile failed for user ${user.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return user;
    }
  }

  async assertApprovedForCustody(user: User): Promise<void> {
    const synced = await this.reconcileUser(user);
    if (!this.sumsub.isConfigured()) {
      assertKycApprovedForCustody(synced);
      return;
    }
    assertKycApprovedFromDb(synced);
  }

  async getStatus(user: User) {
    const synced = await this.reconcileUser(user);
    return {
      status: synced.kycStatus,
      provider: synced.kycProvider,
      verifiedAt: synced.kycVerifiedAt?.toISOString() ?? null,
      rejectionReason: synced.kycRejectionReason,
      externalId: synced.kycExternalId,
      sumsubConfigured: this.sumsub.isConfigured(),
    };
  }

  async createAccessToken(user: User): Promise<{ token: string; userId: string }> {
    const synced = await this.reconcileUser(user);
    let applicantId = synced.kycExternalId;
    const sumsubEmail = sumsubEmailForUser(synced.email);

    if (!applicantId) {
      const existing = await this.sumsub.getApplicantByExternalUserId(synced.id);
      if (existing) {
        applicantId = existing.id;
      } else {
        const created = await this.sumsub.createApplicant({
          externalUserId: synced.id,
          email: sumsubEmail,
        });
        applicantId = created.id;
      }

      if (synced.kycExternalId !== applicantId) {
        await this.users.updateKycStatus(synced.id, {
          status: synced.kycStatus === 'none' ? 'pending' : synced.kycStatus,
          provider: 'sumsub',
          externalId: applicantId,
          payload: { source: 'access_token' },
        });
      } else if (synced.kycStatus === 'none') {
        await this.users.updateKycStatus(synced.id, {
          status: 'pending',
          provider: 'sumsub',
          externalId: applicantId,
          payload: { source: 'access_token' },
        });
      }
    } else if (synced.kycStatus === 'none') {
      await this.users.updateKycStatus(synced.id, {
        status: 'pending',
        provider: 'sumsub',
        externalId: applicantId,
        payload: { source: 'access_token' },
      });
    }

    return this.sumsub.createSdkAccessToken({
      externalUserId: synced.id,
      email: sumsubEmail,
    });
  }
}
