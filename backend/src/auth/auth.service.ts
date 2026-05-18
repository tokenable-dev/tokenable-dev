import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import type { Request } from 'express';
import { MailService } from '../mail/mail.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
/** 구글 로그인 직후 자동 발송 최소 간격 */
const AUTO_SEND_COOLDOWN_MS = 60 * 60 * 1000;
/** 수동 재발송 최소 간격 */
const RESEND_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  validateGoogleProfile(params: {
    googleId: string;
    email: string;
    name?: string | null;
    pictureUrl?: string | null;
    emailVerified?: boolean;
  }): Promise<User> {
    return this.users.findOrCreateFromGoogle(params);
  }

  issueAccessToken(user: User): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
    });
  }

  /** 쿠키 JWT로 사용자 조회 — 없거나 만료면 null (401 대신 200 세션 조회용) */
  async sessionUserFromRequest(req: Request): Promise<User | null> {
    const token = (req.cookies?.access_token as string | undefined)?.trim();
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub?: string }>(token);
      if (!payload?.sub) return null;
      return (await this.users.findById(payload.sub)) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 플랫폼 이메일 미인증이면 인증 메일 발송 (구글 로그인 직후·쿨다운 적용).
   */
  async sendVerificationEmailAfterOAuth(userId: string): Promise<void> {
    await this.sendVerificationEmailInternal(userId, AUTO_SEND_COOLDOWN_MS);
  }

  /** 로그인 사용자가 재발송 (짧은 쿨다운) */
  async resendVerificationEmail(userId: string): Promise<void> {
    await this.sendVerificationEmailInternal(userId, RESEND_COOLDOWN_MS);
  }

  private async sendVerificationEmailInternal(
    userId: string,
    cooldownMs: number,
  ): Promise<void> {
    const user = await this.users.findByIdOrFail(userId);
    if (user.platformEmailVerifiedAt) {
      return;
    }
    const now = Date.now();
    if (user.verificationEmailLastSentAt) {
      const elapsed = now - user.verificationEmailLastSentAt.getTime();
      if (elapsed < cooldownMs) {
        throw new HttpException(
          `Please wait before requesting another email (${Math.ceil((cooldownMs - elapsed) / 1000)}s)`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(now + VERIFY_TOKEN_TTL_MS);
    const lastSent = new Date();

    await this.users.setEmailVerificationToken(
      userId,
      tokenHash,
      expiresAt,
      lastSent,
    );

    const front = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const verifyLink = `${front}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await this.mail.sendVerificationEmail(user.email, verifyLink);
    } catch (e) {
      this.logger.error(`sendVerificationEmail failed: ${String(e)}`);
      throw e;
    }
  }

  async verifyEmailToken(rawToken: string): Promise<boolean> {
    const token = rawToken?.trim();
    if (!token || token.length < 32) {
      return false;
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await this.users.findByEmailVerificationTokenHash(tokenHash);
    if (!user?.emailVerificationExpiresAt) {
      return false;
    }
    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      return false;
    }
    await this.users.markPlatformEmailVerified(user.id);
    return true;
  }
}
