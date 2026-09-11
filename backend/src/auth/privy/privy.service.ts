import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivyClient } from '@privy-io/node';
import type { User as PrivyUser } from '@privy-io/node';
import { isPrivyConfigured, readPrivyEnv } from './privy.config';

@Injectable()
export class PrivyService {
  private readonly client: PrivyClient | null;
  private readonly appId: string | null;

  constructor(config: ConfigService) {
    const env = readPrivyEnv(config);
    this.appId = env.appId;

    this.client = isPrivyConfigured(env)
      ? new PrivyClient({
          appId: env.appId!,
          appSecret: env.appSecret!,
          jwtVerificationKey: env.jwtVerificationKey,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client != null && this.appId != null;
  }

  async verifyAccessToken(accessToken: string): Promise<{ userId: string }> {
    if (!this.client || !this.appId) {
      throw new UnauthorizedException('Privy is not configured');
    }
    const trimmed = accessToken.trim();
    if (!trimmed) {
      throw new UnauthorizedException('Missing Privy access token');
    }
    try {
      const claims = await this.client
        .utils()
        .auth()
        .verifyAccessToken(trimmed);
      return { userId: claims.user_id };
    } catch {
      throw new UnauthorizedException('Invalid Privy access token');
    }
  }

  async fetchUser(userId: string): Promise<PrivyUser> {
    if (!this.client) {
      throw new UnauthorizedException('Privy is not configured');
    }
    return this.client.users()._get(userId);
  }

  /** Underlying `@privy-io/node` client — for Swagger dev proxy only. */
  getClient(): PrivyClient | null {
    return this.client;
  }

  getAppId(): string | null {
    return this.appId;
  }

  requireClient(): PrivyClient {
    if (!this.client) {
      throw new UnauthorizedException('Privy is not configured');
    }
    return this.client;
  }
}
