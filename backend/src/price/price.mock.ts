import type { GetSetsDto } from './dto/get-sets.dto';
import type { GetCardsDto } from './dto/get-cards.dto';
import type { BatchCardsItemDto } from './dto/batch-cards.dto';

/** Static fixtures — no outbound calls (JustTCG free tier / daily limits). */
const MOCK_GAMES = [
  {
    id: 'pokemon',
    name: 'Pokemon',
    count: 28230,
    cards_count: 28230,
    variants_count: 208520,
    sealed_count: 2178,
    sets_count: 210,
    last_updated: '1773037475',
    game_value_usd: 709_469.35,
    game_value_change_7d_pct: 1.46,
    game_value_change_30d_pct: 3.63,
    game_value_change_90d_pct: 11.21,
    cards_pos_7d_count: 19522,
    cards_neg_7d_count: 16131,
    sealed_cards_pos_7d_count: 795,
    sealed_cards_neg_7d_count: 304,
    cards_pos_30d_count: 23734,
    cards_neg_30d_count: 19488,
    sealed_cards_pos_30d_count: 1231,
    sealed_cards_neg_30d_count: 351,
    cards_pos_90d_count: 24547,
    cards_neg_90d_count: 20989,
    sealed_cards_pos_90d_count: 1468,
    sealed_cards_neg_90d_count: 369,
  },
  {
    id: 'topps-baseball',
    name: 'Topps Baseball (Mock)',
    count: 5000,
    cards_count: 5000,
    variants_count: 12000,
    sealed_count: 200,
    sets_count: 40,
    last_updated: '1773037475',
    game_value_usd: 420_000.5,
    game_value_change_7d_pct: 0.85,
    game_value_change_30d_pct: 2.1,
    game_value_change_90d_pct: -1.2,
    cards_pos_7d_count: 100,
    cards_neg_7d_count: 90,
    sealed_cards_pos_7d_count: 10,
    sealed_cards_neg_7d_count: 5,
    cards_pos_30d_count: 200,
    cards_neg_30d_count: 180,
    sealed_cards_pos_30d_count: 20,
    sealed_cards_neg_30d_count: 10,
    cards_pos_90d_count: 250,
    cards_neg_90d_count: 220,
    sealed_cards_pos_90d_count: 25,
    sealed_cards_neg_90d_count: 12,
  },
  {
    id: 'panini-nfl',
    name: 'Panini NFL (Mock)',
    count: 8000,
    cards_count: 8000,
    variants_count: 20000,
    sealed_count: 400,
    sets_count: 55,
    last_updated: '1773037475',
    game_value_usd: 380_250.0,
    game_value_change_7d_pct: -0.42,
    game_value_change_30d_pct: 1.05,
    game_value_change_90d_pct: 4.2,
    cards_pos_7d_count: 120,
    cards_neg_7d_count: 130,
    sealed_cards_pos_7d_count: 15,
    sealed_cards_neg_7d_count: 12,
    cards_pos_30d_count: 300,
    cards_neg_30d_count: 280,
    sealed_cards_pos_30d_count: 30,
    sealed_cards_neg_30d_count: 25,
    cards_pos_90d_count: 400,
    cards_neg_90d_count: 350,
    sealed_cards_pos_90d_count: 40,
    sealed_cards_neg_90d_count: 30,
  },
  {
    id: 'panini-nba',
    name: 'Panini NBA (Mock)',
    count: 6500,
    cards_count: 6500,
    variants_count: 16000,
    sealed_count: 300,
    sets_count: 48,
    last_updated: '1773037475',
    game_value_usd: 295_000.75,
    game_value_change_7d_pct: 2.05,
    game_value_change_30d_pct: -0.5,
    game_value_change_90d_pct: 3.8,
    cards_pos_7d_count: 150,
    cards_neg_7d_count: 140,
    sealed_cards_pos_7d_count: 12,
    sealed_cards_neg_7d_count: 8,
    cards_pos_30d_count: 280,
    cards_neg_30d_count: 260,
    sealed_cards_pos_30d_count: 22,
    sealed_cards_neg_30d_count: 18,
    cards_pos_90d_count: 320,
    cards_neg_90d_count: 300,
    sealed_cards_pos_90d_count: 28,
    sealed_cards_neg_90d_count: 22,
  },
  {
    id: 'magic-the-gathering',
    name: 'Magic: The Gathering',
    count: 105732,
    cards_count: 105732,
    variants_count: 4_677_385,
    sealed_count: 2831,
    sets_count: 435,
    last_updated: '1773033356',
    game_value_usd: 705_471.96,
    game_value_change_7d_pct: 0.46,
    game_value_change_30d_pct: 1.72,
    game_value_change_90d_pct: 4.74,
    cards_pos_7d_count: 58453,
    cards_neg_7d_count: 46847,
    sealed_cards_pos_7d_count: 961,
    sealed_cards_neg_7d_count: 480,
    cards_pos_30d_count: 83193,
    cards_neg_30d_count: 65317,
    sealed_cards_pos_30d_count: 1434,
    sealed_cards_neg_30d_count: 685,
    cards_pos_90d_count: 89214,
    cards_neg_90d_count: 74219,
    sealed_cards_pos_90d_count: 1648,
    sealed_cards_neg_90d_count: 740,
  },
  {
    id: 'yugioh',
    name: 'Yu-Gi-Oh!',
    count: 18000,
    cards_count: 18000,
    variants_count: 95000,
    sealed_count: 800,
    sets_count: 120,
    last_updated: '1773000000',
    game_value_usd: 512_000.0,
    game_value_change_7d_pct: -0.2,
    game_value_change_30d_pct: 0.8,
    game_value_change_90d_pct: 2.0,
    cards_pos_7d_count: 5000,
    cards_neg_7d_count: 4800,
    sealed_cards_pos_7d_count: 100,
    sealed_cards_neg_7d_count: 90,
    cards_pos_30d_count: 9000,
    cards_neg_30d_count: 8500,
    sealed_cards_pos_30d_count: 200,
    sealed_cards_neg_30d_count: 180,
    cards_pos_90d_count: 10000,
    cards_neg_90d_count: 9500,
    sealed_cards_pos_90d_count: 220,
    sealed_cards_neg_90d_count: 200,
  },
] as const;

export function mockGamesResponse(): { data: typeof MOCK_GAMES } {
  return { data: [...MOCK_GAMES] };
}

export function mockSetsResponse(dto: GetSetsDto): {
  data: Array<Record<string, unknown>>;
} {
  return {
    data: [
      {
        id: `${dto.game}-mock-set-1`,
        name: 'Mock Set Alpha',
        game: dto.game,
        cards_count: 120,
        set_value_usd: 45_000,
        set_value_change_7d_pct: 0.5,
        set_value_change_30d_pct: 1.0,
        set_value_change_90d_pct: 2.0,
        release_date: '2024-01-15',
      },
    ],
  };
}

function mockCardRow(
  dto: GetCardsDto,
  index: number,
): Record<string, unknown> {
  const game = dto.game ?? 'pokemon';
  const q = (dto.q ?? 'mock-search').slice(0, 48);
  const now = Math.floor(Date.now() / 1000);
  const baseId = `mock-${game}-card-${index}`;
  return {
    id: baseId,
    name: `Mock Card: ${q}`,
    game,
    set: `${game}-mock-set`,
    set_name: 'Mock Set',
    number: '001',
    rarity: 'Mock',
    tcgplayerId: dto.tcgplayerId ?? '000000',
    mtgjsonId: null,
    scryfallId: null,
    details: null,
    variants: [
      {
        id: `${baseId}_near-mint`,
        condition: 'Near Mint',
        printing: 'Normal',
        language: 'English',
        tcgplayerSkuId: '9990001',
        price: 12.34 + index * 0.5,
        lastUpdated: now,
        priceHistory: [
          { p: 11.0 + index * 0.5, t: now - 86400 * 7 },
          { p: 12.0 + index * 0.5, t: now - 86400 * 3 },
          { p: 12.34 + index * 0.5, t: now },
        ],
      },
    ],
  };
}

export function mockCardsResponse(dto: GetCardsDto): {
  data: Array<Record<string, unknown>>;
  meta: Record<string, unknown>;
} {
  const limit = dto.limit ?? 20;
  const offset = dto.offset ?? 0;
  const n = Math.min(Math.max(1, limit - offset), 5);
  const rows = Array.from({ length: n }, (_, i) =>
    mockCardRow(dto, offset + i),
  );
  return {
    data: rows,
    meta: {
      total: rows.length,
      limit,
      offset,
      hasMore: false,
    },
  };
}

export function mockBatchCardsResponse(
  items: BatchCardsItemDto[],
): { data: Array<Record<string, unknown>> } {
  const now = Math.floor(Date.now() / 1000);
  return {
    data: items.map((item, i) => {
      const id =
        item.cardId ??
        item.variantId?.split('_')[0] ??
        `mock-batch-card-${i}`;
      return {
        id,
        name: `Mock batch card ${i}`,
        game: 'Pokemon',
        tcgplayerId: item.tcgplayerId ?? '219042',
        variants: [
          {
            id: `${id}_near-mint`,
            condition: 'Near Mint',
            printing: item.printing ?? 'Normal',
            price: 10.5 + i * 0.25,
            lastUpdated: now,
            priceHistory: [
              { p: 10.0, t: now - 86400 * 5 },
              { p: 10.5 + i * 0.25, t: now },
            ],
          },
        ],
      };
    }),
  };
}
