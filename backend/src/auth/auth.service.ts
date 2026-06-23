import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { getAddress } from 'ethers';
import type { Request } from 'express';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  EmailVerificationService,
  type VerifyEmailResult,
} from './email-verification.service';
import {
  PasswordResetService,
  type ResetPasswordResult,
} from './password-reset.service';
import { hashPassword, verifyPassword } from './password.util';
import {
  WALLET_LINK_CHALLENGE_TTL_SEC,
  WALLET_LINK_JWT_PURPOSE,
  assertWalletLinkSignature,
  buildWalletLinkMessage,
} from './wallet-link.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
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

  async registerWithEmail(params: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const email = params.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (existing.googleId && !existing.passwordHash) {
        throw new ConflictException(
          'This email is registered with Google. Sign in with Google instead.',
        );
      }
      throw new ConflictException(
        'An account with this email already exists. Sign in instead.',
      );
    }

    const passwordHash = hashPassword(params.password);
    const user = await this.users.createWithPassword({
      email,
      passwordHash,
      name: params.name,
    });
    await this.emailVerification.issueAndSend(user.id);
    return user;
  }

  async loginWithEmail(email: string, password: string): Promise<User> {
    const normalized = email.toLowerCase().trim();
    const user = await this.users.findByEmail(normalized);
    if (!user?.passwordHash) {
      if (user?.googleId) {
        throw new UnauthorizedException('This account uses Google sign-in');
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Check your inbox or resend verification.',
      );
    }
    return user;
  }

  issueAccessToken(user: User): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
    });
  }

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

  resendVerificationEmail(userId: string): Promise<void> {
    return this.emailVerification.resendForUserId(userId);
  }

  resendVerificationEmailByEmail(email: string): Promise<void> {
    return this.emailVerification.resendForEmail(email);
  }

  verifyEmailToken(rawToken: string): Promise<VerifyEmailResult> {
    return this.emailVerification.verifyRawToken(rawToken);
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.passwordReset.requestResetForEmail(email);
  }

  resetPasswordWithToken(
    rawToken: string,
    newPassword: string,
  ): Promise<ResetPasswordResult> {
    return this.passwordReset.resetWithToken(rawToken, newPassword);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findByIdOrFail(userId);
    if (!user.passwordHash) {
      throw new BadRequestException('This account uses Google sign-in');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Verify your email before changing your password.',
      );
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different');
    }
    await this.users.updatePasswordHash(userId, hashPassword(newPassword));
  }

  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.users.findByIdOrFail(userId);
    if (user.passwordHash) {
      if (!password || !verifyPassword(password, user.passwordHash)) {
        throw new UnauthorizedException('Password is incorrect');
      }
    }
    await this.users.deleteById(userId);
  }

  createWalletLinkChallenge(userId: string): { message: string; challenge: string } {
    const nonce = randomBytes(16).toString('hex');
    const issuedAt = new Date().toISOString();
    const message = buildWalletLinkMessage({ userId, nonce, issuedAt });
    const challenge = this.jwt.sign(
      {
        sub: userId,
        purpose: WALLET_LINK_JWT_PURPOSE,
        nonce,
        issuedAt,
      },
      { expiresIn: WALLET_LINK_CHALLENGE_TTL_SEC },
    );
    return { message, challenge };
  }

  async linkWalletWithSignature(
    userId: string,
    address: string,
    signature: string,
    challenge: string,
  ): Promise<User> {
    let payload: {
      sub?: string;
      purpose?: string;
      nonce?: string;
      issuedAt?: string;
    };
    try {
      payload = this.jwt.verify(challenge);
    } catch {
      throw new BadRequestException('Wallet link challenge expired or invalid');
    }
    if (
      payload.purpose !== WALLET_LINK_JWT_PURPOSE ||
      payload.sub !== userId ||
      !payload.nonce ||
      !payload.issuedAt
    ) {
      throw new BadRequestException('Wallet link challenge expired or invalid');
    }

    const normalized = getAddress(address);
    const message = buildWalletLinkMessage({
      userId,
      nonce: payload.nonce,
      issuedAt: payload.issuedAt,
    });
    assertWalletLinkSignature(message, signature, normalized);
    return this.users.addWalletAddress(userId, normalized);
  }
}
