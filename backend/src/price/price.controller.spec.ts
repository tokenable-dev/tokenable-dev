import { Test, TestingModule } from '@nestjs/testing';
import { PriceController } from './price.controller';
import { PriceService } from './price.service';

describe('PriceController', () => {
  const priceService = {
    getGames: jest.fn().mockResolvedValue({ games: [] }),
    getSets: jest.fn().mockResolvedValue({ sets: [] }),
    getCards: jest.fn().mockResolvedValue({ cards: [] }),
    batchCards: jest.fn().mockResolvedValue({ results: [] }),
  };

  let controller: PriceController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PriceController],
      providers: [{ provide: PriceService, useValue: priceService }],
    }).compile();
    controller = module.get(PriceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getGames delegates to PriceService', async () => {
    await controller.getGames();
    expect(priceService.getGames).toHaveBeenCalled();
  });

  it('getSets passes query dto', async () => {
    const dto = { game: 'pokemon' };
    await controller.getSets(dto as never);
    expect(priceService.getSets).toHaveBeenCalledWith(dto);
  });

  it('getCards passes query dto', async () => {
    const dto = { q: 'Pikachu', game: 'pokemon' };
    await controller.getCards(dto as never);
    expect(priceService.getCards).toHaveBeenCalledWith(dto);
  });

  it('batchCards passes items', async () => {
    const body = { items: [{ tcgplayerId: '1' }] };
    await controller.batchCards(body as never);
    expect(priceService.batchCards).toHaveBeenCalledWith(body.items);
  });
});
