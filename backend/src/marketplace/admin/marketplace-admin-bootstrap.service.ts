import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../../auth/password.util';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';

const LEGACY_DEV_ADMIN_USERNAME = 'skyand';

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

    const normalized = username.trim().toLowerCase();
    const isProd =
      (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
      'production';

    let row = await this.admins.findOne({ where: { username: normalized } });

    if (!row && !isProd && normalized !== LEGACY_DEV_ADMIN_USERNAME) {
      const legacy = await this.admins.findOne({
        where: { username: LEGACY_DEV_ADMIN_USERNAME },
      });
      if (legacy) {
        legacy.username = normalized;
        legacy.passwordHash = hashPassword(password);
        row = await this.admins.save(legacy);
        this.logger.warn(
          `Renamed marketplace admin "${LEGACY_DEV_ADMIN_USERNAME}" → "${normalized}" (dev)`,
        );
      }
    }

    if (row) {
      if (
        !isProd &&
        !verifyPassword(password, row.passwordHash)
      ) {
        row.passwordHash = hashPassword(password);
        await this.admins.save(row);
        this.logger.warn(
          `Synced marketplace admin password from env for "${normalized}" (dev)`,
        );
      }
      return;
    }

    await this.admins.save({
      username: normalized,
      passwordHash: hashPassword(password),
    });
    this.logger.warn(`Seeded marketplace admin account "${normalized}" (dev)`);
  }
}
