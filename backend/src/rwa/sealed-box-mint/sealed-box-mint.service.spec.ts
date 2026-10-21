import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VaultService } from '../../vault/vault.service';
import type { User } from '../../user/entities/user.entity';
import { SealedBoxMint } from '../entities/sealed-box-mint.entity';
import {
  SealedBoxMintService,
  sealedBoxVaultRef,
} from './sealed-box-mint.service';

const user = { id: 'user-1' } as User;
const file = {
  buffer: Buffer.from('img'),
  mimetype: 'image/jpeg',
  originalname: 'box.jpg',
} as Express.Multer.File;

function productRow() {
  return [
    {
      id: '7292337',
      product_name: 'Pokemon Evolving Skies Booster Box',
      console_name: 'Pokemon Evolving Skies',
      upc: '820650851100',
    },
  ];
}

describe('sealedBoxVaultRef', () => {
  it('is not the PSA cert vaultRef', () => {
    const boxId = '11111111-1111-4111-8111-111111111111';
    expect(sealedBoxVaultRef(boxId)).not.toBe(VaultService.computeVaultRef('12345678'));
    expect(sealedBoxVaultRef(boxId)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('SealedBoxMintService', () => {
  const mints = {
    findOne: jest.fn(),
    create: jest.fn((row: Partial<SealedBoxMint>) => row),
    save: jest.fn(async (row: SealedBoxMint) => row),
  };
  const execute = jest.fn(async () => undefined);
  const orUpdate = jest.fn(() => ({ execute }));
  const values = jest.fn(() => ({ orUpdate }));
  const into = jest.fn(() => ({ values }));
  const insert = jest.fn(() => ({ into }));
  const rwaTokens = {
    createQueryBuilder: jest.fn(() => ({ insert })),
  };
  const dataSource = { query: jest.fn() };
  const partners = { assertSelfVaultEligibleForUser: jest.fn() };
  const users = { listWalletsForUser: jest.fn() };
  const rwaMint = {
    assertPartnerVaultMintJobPreflight: jest.fn(),
    flushPostMintPortfolioWork: jest.fn(),
  };
  const slabs = { ingestBoxPhoto: jest.fn() };
  const pinata = {
    uploadBuffer: jest.fn(),
    uploadMetadata: jest.fn(),
    ipfsUri: jest.fn((cid: string) => `https://gateway.example/ipfs/${cid}`),
  };
  const chainWriter = { mintTo: jest.fn() };
  const chainConfig = { getRwaAddress: jest.fn(() => '0xabc') };

  const service = new SealedBoxMintService(
    mints as never,
    rwaTokens as never,
    dataSource as never,
    partners as never,
    users as never,
    rwaMint as never,
    slabs as never,
    pinata as never,
    chainWriter as never,
    chainConfig as never,
  );

  const dto = {
    pricechartingProductId: '7292337',
    clientRequestId: '22222222-2222-4222-8222-222222222222',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    partners.assertSelfVaultEligibleForUser.mockResolvedValue({
      partnerId: 'partner-1',
    });
    users.listWalletsForUser.mockResolvedValue([
      { walletAddress: '0x1111111111111111111111111111111111111111', isPrimary: true },
    ]);
    rwaMint.assertPartnerVaultMintJobPreflight.mockResolvedValue(undefined);
    dataSource.query.mockResolvedValue(productRow());
    mints.findOne.mockResolvedValue(null);
    slabs.ingestBoxPhoto.mockResolvedValue({
      objectKey: 'dev/covers/rwa-boxes/1/box/photo',
      publicUrl: 'https://cdn.example/box.jpg',
    });
    pinata.uploadBuffer.mockResolvedValue('bafyimage');
    pinata.uploadMetadata.mockResolvedValue('bafymeta');
    chainWriter.mintTo.mockImplementation(
      async (
        _to: string,
        _uri: string,
        _ref: string,
        _chain: number,
        hooks?: { onSubmitted?: (hash: string) => Promise<void> },
      ) => {
        await hooks?.onSubmitted?.('0x' + 'ab'.repeat(32));
        return { tokenId: 42, txHash: '0x' + 'ab'.repeat(32) };
      },
    );
  });

  it('rejects a missing photo before partner or chain work', async () => {
    await expect(
      service.mintForPartner(user, 11155111, dto, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(partners.assertSelfVaultEligibleForUser).not.toHaveBeenCalled();
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
  });

  it('rejects an unknown catalog product before mint', async () => {
    dataSource.query.mockResolvedValue([]);
    await expect(
      service.mintForPartner(user, 11155111, dto, file),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
    expect(slabs.ingestBoxPhoto).not.toHaveBeenCalled();
  });

  it('does not mint when S3 is not configured', async () => {
    slabs.ingestBoxPhoto.mockRejectedValue(new Error('CATALOG_COVER_S3_NOT_CONFIGURED'));
    await expect(
      service.mintForPartner(user, 11155111, dto, file),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
    expect(pinata.uploadBuffer).not.toHaveBeenCalled();
    const saved = mints.save.mock.calls.at(-1)?.[0] as SealedBoxMint;
    expect(saved.status).toBe('failed');
  });

  it('does not mint when IPFS upload fails', async () => {
    pinata.uploadBuffer.mockRejectedValue(
      new InternalServerErrorException('이미지 IPFS 업로드에 실패했습니다.'),
    );
    await expect(
      service.mintForPartner(user, 11155111, dto, file),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
    const saved = mints.save.mock.calls.at(-1)?.[0] as SealedBoxMint;
    expect(saved.status).toBe('failed');
  });

  it('mints to the partner wallet and stores a cert-less registry row', async () => {
    const result = await service.mintForPartner(user, 11155111, dto, file);
    expect(chainWriter.mintTo).toHaveBeenCalledWith(
      '0x1111111111111111111111111111111111111111',
      'ipfs://bafymeta',
      expect.stringMatching(/^0x[0-9a-f]{64}$/),
      11155111,
      expect.any(Object),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        certNumber: null,
        collectionKey: null,
        vaultCycleId: null,
        tokenId: '42',
        displayImageUrl: 'https://cdn.example/box.jpg',
        settlementPolicy: 'self_vault_hold',
      }),
    );
    expect(result).toMatchObject({
      status: 'minted',
      tokenId: '42',
      tokenURI: 'ipfs://bafymeta',
      productName: 'Pokemon Evolving Skies Booster Box',
    });
  });

  it('refuses a second mint after the transaction was submitted', async () => {
    mints.findOne.mockResolvedValue({
      id: 'box-1',
      status: 'minting',
      mintTxHash: '0x' + 'cd'.repeat(32),
      tokenId: null,
      userId: user.id,
      clientRequestId: dto.clientRequestId,
    });
    await expect(
      service.mintForPartner(user, 11155111, dto, file),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(chainWriter.mintTo).not.toHaveBeenCalled();
  });
});
