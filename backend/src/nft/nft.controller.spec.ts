import { Test, TestingModule } from '@nestjs/testing';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';

const mockNftService = {
  uploadToIpfs: jest.fn().mockResolvedValue({
    tokenURI: 'ipfs://QmTest',
    metadataCID: 'QmTest',
    imageCID: 'QmImage',
    metadata: { name: 'Test NFT', description: 'Test', image: 'ipfs://QmImage' },
  }),
};

describe('NftController', () => {
  let controller: NftController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NftController],
      providers: [{ provide: NftService, useValue: mockNftService }],
    }).compile();

    controller = module.get<NftController>(NftController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
