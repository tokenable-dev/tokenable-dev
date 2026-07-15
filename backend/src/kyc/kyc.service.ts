import { Injectable } from '@nestjs/common';
import type { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { SumsubApiService } from './sumsub-api.service';

@Injectable()
export class KycService {
  constructor(
    private readonly users: UserService,
    private readonly sumsub: SumsubApiService,
  ) {}

  getStatus(user: User) {
    return {
      status: user.kycStatus,
      provider: user.kycProvider,
      verifiedAt: user.kycVerifiedAt?.toISOString() ?? null,
      rejectionReason: user.kycRejectionReason,
      externalId: user.kycExternalId,
      sumsubConfigured: this.sumsub.isConfigured(),
    };
  }

  async createAccessToken(user: User): Promise<{ token: string; userId: string }> {
    let applicantId = user.kycExternalId;

    if (!applicantId) {
      const existing = await this.sumsub.getApplicantByExternalUserId(user.id);
      if (existing) {
        applicantId = existing.id;
      } else {
        const created = await this.sumsub.createApplicant({
          externalUserId: user.id,
          email: user.email,
        });
        applicantId = created.id;
      }

      if (user.kycExternalId !== applicantId) {
        await this.users.updateKycStatus(user.id, {
          status: user.kycStatus === 'none' ? 'pending' : user.kycStatus,
          provider: 'sumsub',
          externalId: applicantId,
          payload: { source: 'access_token' },
        });
      } else if (user.kycStatus === 'none') {
        await this.users.updateKycStatus(user.id, {
          status: 'pending',
          provider: 'sumsub',
          externalId: applicantId,
          payload: { source: 'access_token' },
        });
      }
    } else if (user.kycStatus === 'none') {
      await this.users.updateKycStatus(user.id, {
        status: 'pending',
        provider: 'sumsub',
        externalId: applicantId,
        payload: { source: 'access_token' },
      });
    }

    return this.sumsub.createSdkAccessToken({
      externalUserId: user.id,
      email: user.email,
    });
  }
}
