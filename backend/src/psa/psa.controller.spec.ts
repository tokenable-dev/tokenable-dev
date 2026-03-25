import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PsaController } from './psa.controller';
import { PsaService } from './psa.service';

describe('PsaController', () => {
  const psaService = {
    analyzeSlabImages: jest.fn(),
  };

  let controller: PsaController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PsaController],
      providers: [{ provide: PsaService, useValue: psaService }],
    }).compile();
    controller = module.get(PsaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('throws when slabFront missing', async () => {
    await expect(controller.analyze({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(psaService.analyzeSlabImages).not.toHaveBeenCalled();
  });

  it('calls analyzeSlabImages with front buffer', async () => {
    const buf = Buffer.from('x');
    psaService.analyzeSlabImages.mockResolvedValue({
      ocr: { combinedText: '' },
      psa: {},
      psaApi: { lookup: { status: 'disabled', reason: 'no_token' } },
      justtcg: { queryUsed: '', topMatch: null, rawResponse: {} },
    });
    const out = await controller.analyze({
      slabFront: [{ buffer: buf }],
    } as never);
    expect(psaService.analyzeSlabImages).toHaveBeenCalledWith(buf, undefined);
    expect(out.justtcg.queryUsed).toBe('');
  });
});
