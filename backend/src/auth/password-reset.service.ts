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
import { hashPassword } from './password.util';
import { VerificationTokenType } from './verification-token-type';
import {
  generateVerificationRawToken,
  hashVerificationToken,
  isValidRawVerificationToken,
} from './verification-token.util';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export type ResetPasswordResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid' | 'expired' };

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly users: UserService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** No user enumeration — only email/password accounts receive a reset link. */
  async requestResetForEmail(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      this.logger.debug('Password reset skipped: no matching account');
      return;
    }
    if (!user.passwordHash) {
      if (user.googleId) {
        try {
          await this.mail.sendGoogleOnlySignInEmail(user.email);
        } catch (e) {
          this.logger.error(`sendGoogleOnlySignInEmail failed: ${String(e)}`);
          throw new BadRequestException('Failed to send email');
        }
      } else {
        this.logger.debug('Password reset skipped: account has no password');
      }
      return;
    }

    const rawToken = await this.replaceTokenForUser(user.id, RESEND_COOLDOWN_MS);
    await this.sendResetEmail(user.email, rawToken);
  }

  /** Admin — send password reset email (no cooldown). */
  async adminRequestResetForUserId(userId: string): Promise<void> {
    const user = await this.users.findByIdOrFail(userId);
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Account has no password — use Google sign-in or set a password first',
      );
    }
    const rawToken = await this.replaceTokenForUser(user.id, 0);
    await this.sendResetEmail(user.email, rawToken);
  }

  async resetWithToken(
    rawToken: string,
    newPassword: string,
  ): Promise<ResetPasswordResult> {
    if (!isValidRawVerificationToken(rawToken)) {
      return { ok: false, reason: 'invalid' };
    }

    const tokenHash = hashVerificationToken(rawToken);
    const passwordHash = hashPassword(newPassword);

    return this.dataSource.transaction(async (manager) => {
      const row = await manager
        .getRepository(VerificationToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.token_hash = :tokenHash', { tokenHash })
        .andWhere('t.type = :type', {
          type: VerificationTokenType.PASSWORD_RESET,
        })
        .getOne();

      if (!row) {
        return { ok: false, reason: 'invalid' };
      }

      if (row.expiresAt.getTime() < Date.now()) {
        await manager.delete(VerificationToken, {
          userId: row.userId,
          type: VerificationTokenType.PASSWORD_RESET,
        });
        return { ok: false, reason: 'expired' };
      }

      const user = await manager.findOne(User, { where: { id: row.userId } });
      if (!user?.passwordHash) {
        return { ok: false, reason: 'invalid' };
      }

      user.passwordHash = passwordHash;
      user.emailVerified = true;
      await manager.save(user);
      await manager.delete(VerificationToken, {
        userId: row.userId,
        type: VerificationTokenType.PASSWORD_RESET,
      });

      return { ok: true, user };
    });
  }

  private async replaceTokenForUser(
    userId: string,
    cooldownMs: number,
  ): Promise<string> {
    const rawToken = generateVerificationRawToken();
    const tokenHash = hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VerificationToken);

      if (cooldownMs > 0) {
        const latest = await repo.findOne({
          where: { userId, type: VerificationTokenType.PASSWORD_RESET },
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

      await repo.delete({
        userId,
        type: VerificationTokenType.PASSWORD_RESET,
      });
      await repo.save(
        repo.create({
          userId,
          tokenHash,
          type: VerificationTokenType.PASSWORD_RESET,
          expiresAt,
        }),
      );
    });

    return rawToken;
  }

  private async sendResetEmail(to: string, rawToken: string): Promise<void> {
    const front = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const resetLink = `${front}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.mail.sendPasswordResetEmail(to, resetLink);
    } catch (e) {
      this.logger.error(`sendPasswordResetEmail failed: ${String(e)}`);
      throw new BadRequestException('Failed to send reset email');
    }
  }
}
