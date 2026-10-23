import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { WelcomeEmailService } from '../email/templates/welcome/welcome-email.service';
import { PrivyService, parsePrivyUserProfile } from './privy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly privy: PrivyService,
    private readonly welcomeEmail: WelcomeEmailService,
  ) {}

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

  async deleteAccount(userId: string): Promise<void> {
    await this.users.deleteById(userId);
  }

  /** Verify Privy access token, upsert local user + wallets, return DB user. */
  async authenticatePrivyAccessToken(accessToken: string): Promise<User> {
    if (!this.privy.isConfigured()) {
      throw new BadRequestException('Privy auth is not configured');
    }
    const { userId: privyUserId } =
      await this.privy.verifyAccessToken(accessToken);
    const privyUser = await this.privy.fetchUser(privyUserId);
    let profile;
    try {
      profile = parsePrivyUserProfile(privyUser);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Invalid Privy user profile';
      throw new BadRequestException(message);
    }
    const { user, isNewRegistration } = await this.users.findOrCreateFromPrivy({
      privyId: privyUser.id,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.pictureUrl,
      emailVerified: profile.emailVerified,
      googleId: profile.googleId,
      authProviders: profile.authProviders,
      wallets: profile.wallets,
    });
    void this.welcomeEmail
      .sendForNewRegistration(user, isNewRegistration)
      .catch((err) => {
        this.logger.warn(
          `Welcome email async error userId=${user.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    return user;
  }
}
