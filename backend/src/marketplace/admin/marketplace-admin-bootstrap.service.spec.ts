import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../../auth/password.util';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';
import { MarketplaceAdminBootstrapService } from './marketplace-admin-bootstrap.service';

function makeSvc(
  config: Record<string, string>,
  admins: Partial<MarketplaceAdmin>[],
): { svc: MarketplaceAdminBootstrapService; repo: Repository<MarketplaceAdmin> } {
  const store = [...admins] as MarketplaceAdmin[];
  const repo = {
    findOne: async ({ where }: { where: { username: string } }) =>
      store.find((r) => r.username === where.username) ?? null,
    save: async (row: Partial<MarketplaceAdmin>) => {
      const idx = store.findIndex((r) => r.username === row.username);
      const entity = { id: 'id-1', ...row } as MarketplaceAdmin;
      if (idx >= 0) store[idx] = { ...store[idx], ...entity };
      else store.push(entity);
      return entity;
    },
  } as Repository<MarketplaceAdmin>;

  const configService = {
    get: (key: string) => {
      if (key === 'marketplace.adminUsername') return config.adminUsername;
      if (key === 'marketplace.adminPassword') return config.adminPassword;
      if (key === 'NODE_ENV') return config.NODE_ENV ?? 'development';
      return undefined;
    },
  } as ConfigService;

  return {
    svc: new MarketplaceAdminBootstrapService(repo, configService),
    repo,
  };
}

describe('MarketplaceAdminBootstrapService', () => {
  it('creates admin when missing', async () => {
    const { svc, repo } = makeSvc(
      { adminUsername: 'tokenable_admin', adminPassword: '071725' },
      [],
    );
    await svc.onModuleInit();
    const row = await repo.findOne({ where: { username: 'tokenable_admin' } });
    expect(row).toBeTruthy();
    expect(verifyPassword('071725', row!.passwordHash)).toBe(true);
  });

  it('dev: renames legacy skyand and sets env password', async () => {
    const { svc, repo } = makeSvc(
      {
        adminUsername: 'tokenable_admin',
        adminPassword: '071725',
        NODE_ENV: 'development',
      },
      [
        {
          id: 'legacy',
          username: 'skyand',
          passwordHash: hashPassword('old-secret'),
        },
      ],
    );
    await svc.onModuleInit();
    const legacy = await repo.findOne({ where: { username: 'skyand' } });
    const admin = await repo.findOne({ where: { username: 'tokenable_admin' } });
    expect(legacy).toBeNull();
    expect(admin).toBeTruthy();
    expect(verifyPassword('071725', admin!.passwordHash)).toBe(true);
  });

  it('dev: syncs password when env password does not match', async () => {
    const { svc, repo } = makeSvc(
      {
        adminUsername: 'tokenable_admin',
        adminPassword: '071725',
        NODE_ENV: 'development',
      },
      [
        {
          id: '1',
          username: 'tokenable_admin',
          passwordHash: hashPassword('other'),
        },
      ],
    );
    await svc.onModuleInit();
    const row = await repo.findOne({ where: { username: 'tokenable_admin' } });
    expect(verifyPassword('071725', row!.passwordHash)).toBe(true);
  });

  it('production: does not reset password on mismatch', async () => {
    const otherHash = hashPassword('other');
    const { svc, repo } = makeSvc(
      {
        adminUsername: 'tokenable_admin',
        adminPassword: '071725',
        NODE_ENV: 'production',
      },
      [{ id: '1', username: 'tokenable_admin', passwordHash: otherHash }],
    );
    await svc.onModuleInit();
    const row = await repo.findOne({ where: { username: 'tokenable_admin' } });
    expect(row!.passwordHash).toBe(otherHash);
  });
});
