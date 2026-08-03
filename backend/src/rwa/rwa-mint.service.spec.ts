import { ForbiddenException } from '@nestjs/common';
import { RwaMintService } from './rwa-mint.service';
import type { MintRwaDto } from './dto/mint-rwa.dto';
import type { User } from '../user/entities/user.entity';

describe('RwaMintService', () => {
  const user = { id: 'user-1' } as User;
  const chainId = 137 as const;

  const chainWriter = {
    getCustodyWalletAddress: jest.fn().mockResolvedValue('0xcustody'),
    mintTo: jest.fn().mockResolvedValue({ tokenId: 9, txHash: '0xtx' }),
  };
  const chainConfig = {
    getRwaAddress: jest.fn().mockReturnValue('0xrwa'),
  };
  const users = {
    listWalletsForUser: jest
      .fn()
      .mockResolvedValue([{ walletAddress: '0xUserWallet' }]),
  };
  const vault = {
    reserveCycleForDeposit: jest.fn().mockResolvedValue({
      cycle: { id: 'cycle-1' },
    }),
    recordMintResult: jest.fn().mockResolvedValue(undefined),
    cancelCycle: jest.fn().mockResolvedValue(undefined),
  };
  const vaultSubmissions = {
    attachCycleForCert: jest.fn().mockResolvedValue(undefined),
    markItemCompletedForCycle: jest.fn().mockResolvedValue(undefined),
  };
  const portfolioHoldings = {
    seedVaultDeliveryCostBasis: jest.fn().mockResolvedValue(undefined),
  };
  const portfolioSnapshots = {
    resolveMarkUsdByTokenIds: jest
      .fn()
      .mockResolvedValue(new Map([[9, 1200]])),
  };

  let service: RwaMintService;

  const baseDto: MintRwaDto = {
    recipientAddress: '0xUserWallet',
    tokenURI: 'ipfs://QmMeta',
    certNumber: '83179580',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // KYC gate reads user.kycStatus — stub approved via util mock below if needed.
    (user as { kycStatus?: string }).kycStatus = 'approved';
    service = new RwaMintService(
      chainWriter as never,
      chainConfig as never,
      users as never,
      vault as never,
      vaultSubmissions as never,
      portfolioHoldings as never,
      portfolioSnapshots as never,
    );
  });

  it('mints to custody by default', async () => {
    const result = await service.mintForUser(user, baseDto, chainId);

    expect(chainWriter.mintTo).toHaveBeenCalledWith(
      '0xcustody',
      'ipfs://QmMeta',
      expect.any(String),
      chainId,
    );
    expect(result.deliveryMode).toBe('custody');
    expect(result.mintedTo).toBe('0xcustody');
    expect(result.intendedRecipient).toBe('0xuserwallet');
    expect(portfolioHoldings.seedVaultDeliveryCostBasis).not.toHaveBeenCalled();
  });

  it('mints directly to recipient and seeds cost basis when deliveryMode=direct', async () => {
    const result = await service.mintForUser(
      user,
      { ...baseDto, deliveryMode: 'direct' },
      chainId,
    );

    expect(chainWriter.mintTo).toHaveBeenCalledWith(
      '0xuserwallet',
      'ipfs://QmMeta',
      expect.any(String),
      chainId,
    );
    expect(result.deliveryMode).toBe('direct');
    expect(result.mintedTo).toBe('0xuserwallet');
    expect(result.custodyWallet).toBe('0xcustody');
    expect(portfolioHoldings.seedVaultDeliveryCostBasis).toHaveBeenCalledWith(
      '0xuserwallet',
      9,
      1200,
      expect.any(Date),
      chainId,
    );
  });

  it('rejects unlinked recipient wallets', async () => {
    await expect(
      service.mintForUser(
        user,
        { ...baseDto, recipientAddress: '0xNotLinked' },
        chainId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
  });
});
