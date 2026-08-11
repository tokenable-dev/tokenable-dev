import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RwaMintService } from './rwa-mint.service';
import type { MintRwaDto } from './dto/mint-rwa.dto';
import type { User } from '../user/entities/user.entity';

describe('RwaMintService', () => {
  const user = { id: 'user-1' } as User;
  const chainId = 137 as const;

  const chainWriter = {
    getCustodyWalletAddress: jest.fn().mockResolvedValue('0xcustody'),
    mintTo: jest.fn().mockResolvedValue({ tokenId: 9, txHash: '0xtx' }),
    safeTransferFromCustody: jest
      .fn()
      .mockResolvedValue({ txHash: '0xdeliver' }),
  };
  const blockchain = {
    getRwaTokenOwner: jest.fn().mockResolvedValue('0xcustody'),
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
    assertCertAvailableForSelfVault: jest.fn().mockResolvedValue(undefined),
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

  const partners = {
    getSelfVaultEligibility: jest.fn().mockResolvedValue({
      eligible: true,
      isPartner: true,
      hasCompanyAddress: true,
      partnerId: 'partner-1',
      displayName: 'Acme',
      vaultLabel: 'Acme vault',
    }),
    assertSelfVaultEligibleForWallet: jest.fn().mockResolvedValue({
      partnerId: 'partner-1',
      displayName: 'Acme',
      vaultLabel: 'Acme vault',
    }),
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
    partners.getSelfVaultEligibility.mockResolvedValue({
      eligible: true,
      isPartner: true,
      hasCompanyAddress: true,
      partnerId: 'partner-1',
      displayName: 'Acme',
      vaultLabel: 'Acme vault',
    });
    partners.assertSelfVaultEligibleForWallet.mockResolvedValue({
      partnerId: 'partner-1',
      displayName: 'Acme',
      vaultLabel: 'Acme vault',
    });
    service = new RwaMintService(
      chainWriter as never,
      blockchain as never,
      chainConfig as never,
      users as never,
      vault as never,
      vaultSubmissions as never,
      portfolioHoldings as never,
      portfolioSnapshots as never,
      partners as never,
      { assertApprovedForCustody: jest.fn().mockResolvedValue(undefined) } as never,
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
    expect(vault.recordMintResult).toHaveBeenCalledWith(
      expect.objectContaining({ settlementPolicy: 'standard' }),
    );
  });

  it('mints directly to recipient and seeds cost basis when deliveryMode=direct', async () => {
    const result = await service.mintForUser(
      user,
      { ...baseDto, deliveryMode: 'direct' },
      chainId,
    );

    expect(
      vaultSubmissions.assertCertAvailableForSelfVault,
    ).toHaveBeenCalledWith('83179580');
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
    expect(vault.recordMintResult).toHaveBeenCalledWith(
      expect.objectContaining({
        settlementPolicy: 'self_vault_hold',
        vaultPartnerId: 'partner-1',
      }),
    );
  });

  it('rejects direct mint for non-partner wallets', async () => {
    partners.assertSelfVaultEligibleForWallet.mockRejectedValueOnce(
      new ForbiddenException({
        statusCode: 403,
        code: 'SELF_VAULT_PARTNER_ONLY',
        message:
          'Self vault is available only to contracted Tokenable partners',
      }),
    );
    await expect(
      service.mintForUser(
        user,
        { ...baseDto, deliveryMode: 'direct' },
        chainId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(vault.reserveCycleForDeposit).not.toHaveBeenCalled();
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
  });

  it('rejects direct mint when partner lacks company address', async () => {
    partners.assertSelfVaultEligibleForWallet.mockRejectedValueOnce(
      new ForbiddenException({
        statusCode: 403,
        code: 'COMPANY_ADDRESS_REQUIRED',
        message:
          'Self vault requires a company vault address — set it in Settings → Addresses',
      }),
    );
    try {
      await service.mintForUser(
        user,
        { ...baseDto, deliveryMode: 'direct' },
        chainId,
      );
      fail('expected ForbiddenException');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      const body = (e as ForbiddenException).getResponse() as {
        code?: string;
      };
      expect(body.code).toBe('COMPANY_ADDRESS_REQUIRED');
    }
    expect(vault.reserveCycleForDeposit).not.toHaveBeenCalled();
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
  });

  it('does not run self-vault shipment guard for custody mints', async () => {
    await service.mintForUser(user, baseDto, chainId);
    expect(
      vaultSubmissions.assertCertAvailableForSelfVault,
    ).not.toHaveBeenCalled();
  });

  it('rejects direct mint when cert is locked in a PSA shipment', async () => {
    vaultSubmissions.assertCertAvailableForSelfVault.mockRejectedValueOnce(
      new BadRequestException('in transit'),
    );
    await expect(
      service.mintForUser(
        user,
        { ...baseDto, deliveryMode: 'direct' },
        chainId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vault.reserveCycleForDeposit).not.toHaveBeenCalled();
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
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

  it('mintCustodyThenDeliverForUser mints to custody then transfers to user', async () => {
    const result = await service.mintCustodyThenDeliverForUser(
      user,
      baseDto,
      chainId,
    );

    expect(chainWriter.mintTo).toHaveBeenCalledWith(
      '0xcustody',
      'ipfs://QmMeta',
      expect.any(String),
      chainId,
    );
    expect(chainWriter.safeTransferFromCustody).toHaveBeenCalledWith(
      9,
      '0xuserwallet',
      chainId,
    );
    expect(result.deliverTxHash).toBe('0xdeliver');
    expect(result.mintedTo).toBe('0xuserwallet');
    expect(portfolioHoldings.seedVaultDeliveryCostBasis).toHaveBeenCalled();
  });

  it('adoptExistingMintedAndDeliverForUser delivers from custody without reminting', async () => {
    blockchain.getRwaTokenOwner.mockResolvedValueOnce('0xcustody');
    const result = await service.adoptExistingMintedAndDeliverForUser(
      user,
      {
        recipientAddress: '0xUserWallet',
        certNumber: '83179580',
        tokenId: 10,
        tokenURI: 'ipfs://existing',
        vaultRef: '0xref',
        cycleId: 'cycle-existing',
      },
      chainId,
    );

    expect(chainWriter.mintTo).not.toHaveBeenCalled();
    expect(vaultSubmissions.attachCycleForCert).toHaveBeenCalledWith({
      userId: 'user-1',
      certNumber: '83179580',
      cycleId: 'cycle-existing',
    });
    expect(chainWriter.safeTransferFromCustody).toHaveBeenCalledWith(
      10,
      '0xuserwallet',
      chainId,
    );
    expect(vaultSubmissions.markItemCompletedForCycle).toHaveBeenCalledWith(
      'cycle-existing',
    );
    expect(result.adoptedExisting).toBe(true);
    expect(result.alreadyWithUser).toBe(false);
    expect(result.deliverTxHash).toBe('0xdeliver');
  });

  it('adoptExistingMintedAndDeliverForUser skips transfer when user already holds NFT', async () => {
    blockchain.getRwaTokenOwner.mockResolvedValueOnce('0xuserwallet');
    const result = await service.adoptExistingMintedAndDeliverForUser(
      user,
      {
        recipientAddress: '0xUserWallet',
        certNumber: '83179580',
        tokenId: 10,
        tokenURI: 'ipfs://existing',
        vaultRef: '0xref',
        cycleId: 'cycle-existing',
      },
      chainId,
    );

    expect(chainWriter.safeTransferFromCustody).not.toHaveBeenCalled();
    expect(result.alreadyWithUser).toBe(true);
    expect(result.deliverTxHash).toBeNull();
  });
});
