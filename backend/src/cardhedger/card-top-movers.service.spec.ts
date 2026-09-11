import { CardhedgerService } from './cardhedger.service';
import {
  CardTopMoversService,
  TOP_MOVERS_CACHE_TTL_MS,
} from './card-top-movers.service';

describe('CardTopMoversService', () => {
  const upstreamBody = {
    cards: [
      {
        card_id: 'abc123',
        description: 'Pikachu Base Set',
        player: 'Pikachu',
        set: 'Base Set',
        number: '58',
        variant: 'Base',
        image: '//cdn.example/pika.jpg',
        category: 'Pokemon',
        category_group: 'Pokemon',
        set_type: 'Base Set',
        gain: 42.5,
        rookie: false,
        '7 Day Sales': 3,
        '30 Day Sales': 12,
        prices: [{ grade: 'PSA 10', price: '1200' }],
      },
    ],
    total_count: 1,
    filtered_count: 1,
    gain_threshold: 500,
  };

  it('caches upstream responses for 1h', async () => {
    const forwardJson = jest.fn(async () => upstreamBody);
    const cardhedger = { forwardJson } as unknown as CardhedgerService;
    const svc = new CardTopMoversService(cardhedger);

    const first = await svc.getTopMovers({ category: 'Pokemon', count: 5 });
    const second = await svc.getTopMovers({ category: 'Pokemon', count: 5 });

    expect(forwardJson).toHaveBeenCalledTimes(1);
    expect(forwardJson).toHaveBeenCalledWith('GET', '/v1/cards/top-movers', {
      query: { count: '5', category: 'Pokemon' },
    });
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(first.cards[0]?.card_id).toBe('abc123');
    expect(first.cards[0]?.gain).toBe(42.5);
    expect(TOP_MOVERS_CACHE_TTL_MS).toBe(3_600_000);
  });

  it('clearCache forces upstream refetch', async () => {
    const forwardJson = jest.fn(async () => upstreamBody);
    const cardhedger = { forwardJson } as unknown as CardhedgerService;
    const svc = new CardTopMoversService(cardhedger);

    await svc.getTopMovers({ category: 'Baseball', count: 10 });
    svc.clearCache('Baseball', 10);
    await svc.getTopMovers({ category: 'Baseball', count: 10 });

    expect(forwardJson).toHaveBeenCalledTimes(2);
  });
});
