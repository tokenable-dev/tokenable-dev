import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword } from '../../auth/password.util';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';

/** Ensures the configured default admin account exists in `marketplace_admins`. */
@Injectable()
export class MarketplaceAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceAdminBootstrapService.name);

  constructor(
    @InjectRepository(MarketplaceAdmin)
    private readonly admins: Repository<MarketplaceAdmin>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const username = this.config.get<string>('marketplace.adminUsername');
    const password = this.config.get<string>('marketplace.adminPassword');
    if (!username || !password) return;

    const existing = await this.admins.findOne({ where: { username } });
    if (existing) return;

    await this.admins.save({
      username: username.toLowerCase(),
      passwordHash: hashPassword(password),
    });
    this.logger.log(`Seeded marketplace admin account "${username}"`);
  }
}
