import { BadRequestException } from '@nestjs/common';
import { RwaService } from './rwa.service';

describe('RwaService.uploadToIpfs', () => {
  const pinata = {
    uploadFile: jest.fn().mockResolvedValue('bafyImage'),
    uploadBuffer: jest.fn().mockResolvedValue('bafyImage'),
    fetchImageBufferFromUrl: jest.fn(),
    uploadMetadata: jest.fn().mockResolvedValue('bafyMeta'),
    ipfsHttpsUrl: jest.fn((cid: string) => `https://gateway.test/ipfs/${cid}`),
    ipfsUri: jest.fn((cid: string) => `ipfs://${cid}`),
  };
  const vault = {
    assertAvailableForNewCycle: jest.fn().mockResolvedValue(undefined),
    checkAvailableForNewCycle: jest.fn().mockResolvedValue({
      available: true,
      certNumber: '84089328',
      message: null,
    }),
  };
  const vaultSubmissions = {
    assertCertAvailableForSelfVault: jest.fn().mockResolvedValue(undefined),
  };
  const rwaSlabS3 = {
    ingestMintSlabBestEffort: jest.fn(),
  };

  let service: RwaService;

  const gradedMetadata = JSON.stringify({
    graded: {
      gradingCompany: 'PSA',
      grade: { score: 10 },
      psa: { certNumber: '84089328' },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rwaSlabS3.ingestMintSlabBestEffort.mockResolvedValue(
      'https://cdn.example.com/dev/covers/rwa-slabs/84532/84089328/slab',
    );
    service = new RwaService(
      pinata as never,
      vault as never,
      vaultSubmissions as never,
      rwaSlabS3 as never,
    );
  });

  it('returns displayImageUrl when S3 ingest succeeds (imageUrl path)', async () => {
    pinata.fetchImageBufferFromUrl.mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });

    const result = await service.uploadToIpfs(
      {
        name: 'Charizard',
        description: 'Test',
        imageUrl: 'https://psa.example/front.jpg',
        gradedMetadata,
      },
      84532,
    );

    expect(result.displayImageUrl).toBe(
      'https://cdn.example.com/dev/covers/rwa-slabs/84532/84089328/slab',
    );
    expect(rwaSlabS3.ingestMintSlabBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 84532,
        certNumber: '84089328',
      }),
    );
    expect(result.displayImageBackUrl).toBeNull();
    expect(pinata.uploadBuffer).toHaveBeenCalled();
  });

  it('still succeeds when S3 ingest fails', async () => {
    pinata.fetchImageBufferFromUrl.mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    rwaSlabS3.ingestMintSlabBestEffort.mockResolvedValue(null);

    const result = await service.uploadToIpfs(
      {
        name: 'Charizard',
        description: 'Test',
        imageUrl: 'https://psa.example/front.jpg',
        gradedMetadata,
      },
      84532,
    );

    expect(result.tokenURI).toBe('ipfs://bafyMeta');
    expect(result.displayImageUrl).toBeNull();
  });

  it('uses Tokenable placeholder when no image file or URL', async () => {
    pinata.uploadFile.mockResolvedValue('bafyPlaceholder');

    const result = await service.uploadToIpfs(
      {
        name: 'Charizard',
        description: 'Test',
        gradedMetadata,
      },
      84532,
    );

    expect(pinata.uploadFile).toHaveBeenCalled();
    expect(pinata.fetchImageBufferFromUrl).not.toHaveBeenCalled();
    expect(result.metadata.properties?.mintImageSource).toBe(
      'tokenable_placeholder',
    );
    expect(result.tokenURI).toBe('ipfs://bafyMeta');
  });

  it('fails when image fetch fails (before mint)', async () => {
    pinata.fetchImageBufferFromUrl.mockRejectedValue(new Error('network'));

    await expect(
      service.uploadToIpfs(
        {
          name: 'Charizard',
          description: 'Test',
          imageUrl: 'https://psa.example/front.jpg',
          gradedMetadata,
        },
        84532,
      ),
    ).rejects.toThrow('URL 이미지를 가져오지 못했습니다.');
    expect(pinata.uploadMetadata).not.toHaveBeenCalled();
  });

  it('rejects invalid graded metadata before any upload', async () => {
    await expect(
      service.uploadToIpfs(
        {
          name: 'X',
          description: 'Y',
          imageUrl: 'https://psa.example/front.jpg',
          gradedMetadata: '{not json',
        },
        84532,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pinata.fetchImageBufferFromUrl).not.toHaveBeenCalled();
  });
});

describe('RwaService.checkCertAvailability', () => {
  const pinata = {} as never;
  const vault = {
    checkAvailableForNewCycle: jest.fn(),
  };
  const vaultSubmissions = {
    assertCertAvailableForSelfVault: jest.fn(),
  };
  const rwaSlabS3 = {} as never;

  let service: RwaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RwaService(pinata, vault as never, vaultSubmissions as never, rwaSlabS3);
  });

  it('returns unavailable when an open vault cycle exists', async () => {
    vault.checkAvailableForNewCycle.mockResolvedValue({
      available: false,
      certNumber: '150726566',
      message: 'already minted',
    });

    const result = await service.checkCertAvailability('150726566', 11155111);

    expect(result.available).toBe(false);
    expect(vaultSubmissions.assertCertAvailableForSelfVault).not.toHaveBeenCalled();
  });

  it('returns unavailable when cert is blocked by PSA shipment', async () => {
    vault.checkAvailableForNewCycle.mockResolvedValue({
      available: true,
      certNumber: '150726566',
      message: null,
    });
    vaultSubmissions.assertCertAvailableForSelfVault.mockRejectedValue(
      new BadRequestException(
        'PSA cert #150726566 is already in PSA vault shipment SUB-20260902-00001',
      ),
    );

    const result = await service.checkCertAvailability('150726566', 11155111);

    expect(result).toEqual({
      available: false,
      certNumber: '150726566',
      message:
        'PSA cert #150726566 is already in PSA vault shipment SUB-20260902-00001',
    });
  });

  it('returns available when cycle and PSA shipment checks pass', async () => {
    vault.checkAvailableForNewCycle.mockResolvedValue({
      available: true,
      certNumber: '150726566',
      message: null,
    });
    vaultSubmissions.assertCertAvailableForSelfVault.mockResolvedValue(undefined);

    const result = await service.checkCertAvailability('150726566', 11155111);

    expect(result).toEqual({
      available: true,
      certNumber: '150726566',
      message: null,
    });
  });
});
