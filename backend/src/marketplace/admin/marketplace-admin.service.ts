import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { verifyPassword } from '../../auth/password.util';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';
import {
  MARKETPLACE_ADMIN_COOKIE,
  verifyMarketplaceAdminToken,
} from './marketplace-admin-auth.util';

@Injectable()
export class MarketplaceAdminService {
  constructor(
    @InjectRepository(MarketplaceAdmin)
    private readonly admins: Repository<MarketplaceAdmin>,
    private readonly config: ConfigService,
  ) {}

  getSessionUsername(req: Request): string | null {
    const token = req.cookies?.[MARKETPLACE_ADMIN_COOKIE] as string | undefined;
    const secret = this.config.get<string>('marketplace.adminSessionSecret');
    if (!secret || !verifyMarketplaceAdminToken(token, secret)) {
      return null;
    }
    return this.config.get<string>('marketplace.adminUsername') ?? null;
  }

  hasAdminSession(req: Request): boolean {
    return this.getSessionUsername(req) != null;
  }

  assertAdminSession(req: Request): void {
    if (!this.hasAdminSession(req)) {
      throw new ForbiddenException('Admin session required');
    }
  }

  async verifyCredentials(
    username: string,
    password: string,
  ): Promise<string | null> {
    const normalized = username.trim().toLowerCase();
    if (!normalized || !password) return null;

    const row = await this.admins.findOne({
      where: { username: normalized },
    });
    if (!row || !verifyPassword(password, row.passwordHash)) {
      return null;
    }
    return row.username;
  }
}
