import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MarketplacePartnersService } from './marketplace-partners.service';

describe('MarketplacePartnersService company address', () => {
  const partnerRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({
      ...x,
      id: x.id ?? 'partner-1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    })),
  };
  const addressRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({
      ...x,
      id: x.id ?? 'addr-1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    })),
  };
  const users = {
    listWalletsForUser: jest.fn(),
    findById: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('a'.repeat(64)),
  };

  let service: MarketplacePartnersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketplacePartnersService(
      partnerRepo as never,
      addressRepo as never,
      users as never,
      config as never,
    );
  });

  it('requires region for US company address', async () => {
    partnerRepo.findOne.mockResolvedValue({
      id: 'partner-1',
      displayName: 'Acme',
      walletAddress: '0xabc',
      isActive: true,
    });
    await expect(
      service.upsertCompanyAddressForPartner('partner-1', {
        companyName: 'Acme',
        contactName: 'Jordan',
        phone: '+1 555',
        country: 'US',
        city: 'LA',
        postal: '90015',
        line1: '1200 Fig',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts ISO country address and exposes eligibility', async () => {
    const wallet = '0xac5ebb0573ca515741d8986a1ba1cdc178f46539';
    partnerRepo.findOne.mockResolvedValue({
      id: 'partner-1',
      displayName: 'Acme',
      walletAddress: wallet,
      isActive: true,
      encryptedPrivateKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    addressRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'addr-1',
        partnerId: 'partner-1',
        companyName: 'Acme',
        contactName: 'Jordan',
        phone: '+1 555',
        country: 'US',
        city: 'Los Angeles',
        region: 'CA',
        postal: '90015',
        line1: '1200 Figueroa St',
        line2: null,
        residential: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    const saved = await service.upsertCompanyAddressForPartner('partner-1', {
      companyName: 'Acme',
      contactName: 'Jordan',
      phone: '+1 555',
      country: 'us',
      city: 'Los Angeles',
      region: 'CA',
      postal: '90015',
      line1: '1200 Figueroa St',
    });
    expect(saved.country).toBe('US');
    expect(addressRepo.save).toHaveBeenCalled();

    const elig = await service.getSelfVaultEligibility(wallet);
    expect(elig.isPartner).toBe(true);
    expect(elig.hasCompanyAddress).toBe(true);
    expect(elig.eligible).toBe(true);
  });

  it('assertSelfVaultEligibleForWallet throws COMPANY_ADDRESS_REQUIRED', async () => {
    const wallet = '0xac5ebb0573ca515741d8986a1ba1cdc178f46539';
    partnerRepo.findOne.mockResolvedValue({
      id: 'partner-1',
      displayName: 'Acme',
      walletAddress: wallet,
      isActive: true,
    });
    addressRepo.findOne.mockResolvedValue(null);

    try {
      await service.assertSelfVaultEligibleForWallet(wallet);
      fail('expected ForbiddenException');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      const body = (e as ForbiddenException).getResponse() as {
        code?: string;
      };
      expect(body.code).toBe('COMPANY_ADDRESS_REQUIRED');
    }
  });

  it('rejects company address upsert for non-partner users', async () => {
    users.listWalletsForUser.mockResolvedValue([]);
    users.findById.mockResolvedValue({ walletAddress: null });
    await expect(
      service.upsertCompanyAddressForUser('user-1', {
        companyName: 'Acme',
        contactName: 'Jordan',
        phone: '+1 555',
        country: 'US',
        city: 'LA',
        region: 'CA',
        postal: '90015',
        line1: '1200 Fig',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
