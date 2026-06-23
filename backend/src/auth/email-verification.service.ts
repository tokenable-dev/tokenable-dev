import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { VerificationToken } from './entities/verification-token.entity';
import { VerificationTokenType } from './verification-token-type';
import {
  generateVerificationRawToken,
  hashVerificationToken,
  isValidRawVerificationToken,
} from './verification-token.util';

const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export type VerifyEmailResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly users: UserService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async issueAndSend(userId: string): Promise<void> {
    const user = await this.users.findByIdOrFail(userId);
    if (user.emailVerified) return;

    const rawToken = await this.replaceTokenForUser(userId, 0);
    await this.sendVerificationEmail(user.email, rawToken);
  }

  async resendForUserId(userId: string): Promise<void> {
    const user = await this.users.findByIdOrFail(userId);
    if (user.emailVerified) return;

    const rawToken = await this.replaceTokenForUser(
      userId,
      RESEND_COOLDOWN_MS,
    );
    await this.sendVerificationEmail(user.email, rawToken);
  }

  /** Public resend by email — no user enumeration on unknown email. */
  async resendForEmail(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerified || !user.passwordHash) {
      return;
    }

    const rawToken = await this.replaceTokenForUser(
      user.id,
      RESEND_COOLDOWN_MS,
    );
    await this.sendVerificationEmail(user.email, rawToken);
  }

  async verifyRawToken(rawToken: string): Promise<VerifyEmailResult> {
    if (!isValidRawVerificationToken(rawToken)) {
      return { ok: false, reason: 'invalid' };
    }

    const tokenHash = hashVerificationToken(rawToken);

    return this.dataSource.transaction(async (manager) => {
      const row = await manager
        .getRepository(VerificationToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.token_hash = :tokenHash', { tokenHash })
        .andWhere('t.type = :type', { type: VerificationTokenType.EMAIL_VERIFY })
        .getOne();

      if (!row) {
        return { ok: false, reason: 'invalid' };
      }

      if (row.expiresAt.getTime() < Date.now()) {
        await manager.delete(VerificationToken, { userId: row.userId });
        return { ok: false, reason: 'expired' };
      }

      await manager.update(User, { id: row.userId }, { emailVerified: true });
      await manager.delete(VerificationToken, { userId: row.userId });
      return { ok: true };
    });
  }

  private async replaceTokenForUser(
    userId: string,
    cooldownMs: number,
  ): Promise<string> {
    const rawToken = generateVerificationRawToken();
    const tokenHash = hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VerificationToken);

      if (cooldownMs > 0) {
        const latest = await repo.findOne({
          where: { userId, type: VerificationTokenType.EMAIL_VERIFY },
          order: { createdAt: 'DESC' },
          lock: { mode: 'pessimistic_write' },
        });
        if (latest) {
          const elapsed = Date.now() - latest.createdAt.getTime();
          if (elapsed < cooldownMs) {
            throw new HttpException(
              `Please wait before requesting another email (${Math.ceil((cooldownMs - elapsed) / 1000)}s)`,
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }
        }
      }

      await repo.delete({ userId });
      await repo.save(
        repo.create({
          userId,
          tokenHash,
          type: VerificationTokenType.EMAIL_VERIFY,
          expiresAt,
        }),
      );
    });

    return rawToken;
  }

  private async sendVerificationEmail(
    to: string,
    rawToken: string,
  ): Promise<void> {
    const front = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const verifyLink = `${front}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.mail.sendVerificationEmail(to, verifyLink);
    } catch (e) {
      this.logger.error(`sendVerificationEmail failed: ${String(e)}`);
      throw new BadRequestException('Failed to send verification email');
    }
  }
}
