import { Test, TestingModule } from '@nestjs/testing';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';
import { UploadNftDto } from './dto/upload-nft.dto';

const mockNftService = {
  uploadToIpfs: jest.fn().mockResolvedValue({
    tokenURI: 'ipfs://QmTest',
    metadataCID: 'QmTest',
    imageCID: 'QmImage',
    metadata: {
      name: 'Test NFT',
      description: 'Test',
      image: 'ipfs://QmImage',
    },
  }),
};

describe('NftController', () => {
  let controller: NftController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NftController],
      providers: [{ provide: NftService, useValue: mockNftService }],
    }).compile();

    controller = module.get<NftController>(NftController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uploadToIpfs delegates to NftService', async () => {
    const dto: UploadNftDto = {
      name: 'N',
      description: 'D',
    };
    const file = { mimetype: 'image/png' } as Express.Multer.File;
    const result = await controller.uploadToIpfs(dto, file);
    expect(mockNftService.uploadToIpfs).toHaveBeenCalledWith(dto, file);
    expect(result.tokenURI).toBe('ipfs://QmTest');
  });
});
