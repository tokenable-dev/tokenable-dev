import { CollectionCoverService } from './collection-cover.service';

describe('CollectionCoverService.attachCardhedgerFromPsaCert', () => {
  function buildService(forwardJson: jest.Mock) {
    const cardhedger = {
      assertConfigured: jest.fn(),
      forwardJson,
    };
    const catalogCoverS3 = {
      isConfigured: jest.fn().mockReturnValue(false),
    };
    return new CollectionCoverService(
      { findOne: jest.fn(), update: jest.fn() } as never,
      {} as never,
      cardhedger as never,
      {} as never,
      catalogCoverS3 as never,
    );
  }

  it('attaches cardId and imageUrl from details-by-certs', async () => {
    const forwardJson = jest.fn().mockResolvedValue({
      results: [
        {
          cert_info: { cert: '83179580', description: '1999 Base Charizard #4' },
          card: {
            card_id: 'ch_abc',
            image: 'https://cdn.example.com/charizard.jpg',
          },
        },
      ],
    });
    const svc = buildService(forwardJson);
    const meta = {
      properties: {
        graded: {
          psa: { certNumber: '83179580', cardNameHint: 'Charizard' },
        },
      },
    };

    const out = await svc.attachCardhedgerFromPsaCert(meta, '83179580');
    const ch = (out.properties as { graded: { cardhedger: Record<string, string> } })
      .graded.cardhedger;

    expect(ch.cardId).toBe('ch_abc');
    expect(ch.imageUrl).toBe('https://cdn.example.com/charizard.jpg');
    expect(ch.searchQuery).toBe('1999 Base Charizard #4');
    expect(forwardJson).toHaveBeenCalledWith(
      'POST',
      '/v1/cards/details-by-certs',
      expect.objectContaining({
        body: { certs: ['83179580'], grader: 'PSA' },
      }),
    );
  });

  it('does not attach a Reverse Foil cert cardId when PSA Variety is Master Ball', async () => {
    const forwardJson = jest
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            cert_info: {
              cert: '83297897',
              description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
            },
            card: {
              card_id: 'ch_reverse_foil',
              variant: 'Reverse Foil',
              description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
              name: 'Gengar',
              set: 'Pokemon Japanese 151',
              number: '094',
              image: 'https://cdn.example.com/reverse.jpg',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        cards: [
          {
            card_id: 'ch_master_ball',
            variant: 'Master Ball',
            description: 'Pokemon Japanese 151 Gengar Master Ball 094',
            name: 'Gengar',
            number: '094',
            image: 'https://cdn.example.com/master.jpg',
          },
          {
            card_id: 'ch_reverse_foil',
            variant: 'Reverse Foil',
            description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
            name: 'Gengar',
            number: '094',
          },
        ],
      });
    const svc = buildService(forwardJson);
    const meta = {
      properties: {
        graded: {
          psa: {
            certNumber: '83297897',
            cardNameHint: 'Gengar',
            cardNumberHint: '094',
            Variety: 'MASTER BALL REVERSE HOLO',
          },
        },
      },
    };

    const out = await svc.attachCardhedgerFromPsaCert(meta, '83297897');
    const ch = (
      out.properties as { graded: { cardhedger: Record<string, string> } }
    ).graded.cardhedger;

    expect(ch.cardId).toBe('ch_master_ball');
    expect(ch.imageUrl).toBe('https://cdn.example.com/master.jpg');
    expect(forwardJson).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/v1/cards/card-search',
      expect.objectContaining({
        body: expect.objectContaining({
          search: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
        }),
      }),
    );
  });

  it('does not persist Reverse Foil when Master Ball is absent from search', async () => {
    const forwardJson = jest
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            cert_info: {
              cert: '83297897',
              description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
            },
            card: {
              card_id: 'ch_reverse_foil',
              variant: 'Reverse Foil',
              name: 'Gengar',
              number: '094',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        cards: [
          {
            card_id: 'ch_reverse_foil',
            variant: 'Reverse Foil',
            description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
            name: 'Gengar',
            number: '094',
          },
        ],
      });
    const svc = buildService(forwardJson);
    const meta = {
      properties: {
        graded: {
          psa: {
            certNumber: '83297897',
            cardNameHint: 'Gengar',
            cardNumberHint: '094',
            Variety: 'MASTER BALL REVERSE HOLO',
          },
        },
      },
    };

    const out = await svc.attachCardhedgerFromPsaCert(meta, '83297897');
    const ch = (
      out.properties as { graded: { cardhedger: Record<string, string> } }
    ).graded.cardhedger;

    expect(ch.cardId).toBeUndefined();
    expect(ch.searchQuery).toBe(
      'Pokemon Japanese 151 Gengar Reverse Foil 094',
    );
  });

  it('fetches card-details image when cert row has cardId but no image', async () => {
    const forwardJson = jest
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            cert_info: { cert: '83179580' },
            card: { card_id: 'ch_abc' },
          },
        ],
      })
      .mockResolvedValueOnce({
        cards: [{ image: 'https://cdn.example.com/from-details.jpg' }],
      });
    const svc = buildService(forwardJson);

    const out = await svc.attachCardhedgerFromPsaCert(
      { properties: { graded: {} } },
      '83179580',
    );
    const ch = (out.properties as { graded: { cardhedger: Record<string, string> } })
      .graded.cardhedger;

    expect(ch.cardId).toBe('ch_abc');
    expect(ch.imageUrl).toBe('https://cdn.example.com/from-details.jpg');
    expect(forwardJson).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/v1/cards/card-details',
      { body: { card_id: 'ch_abc' } },
    );
  });

  it('returns meta unchanged when Cardhedger is not configured', async () => {
    const cardhedger = {
      assertConfigured: jest.fn(() => {
        throw new Error('not configured');
      }),
      forwardJson: jest.fn(),
    };
    const svc = new CollectionCoverService(
      { findOne: jest.fn(), update: jest.fn() } as never,
      {} as never,
      cardhedger as never,
      {} as never,
      { isConfigured: jest.fn().mockReturnValue(false) } as never,
    );
    const meta = { properties: { graded: {} } };
    const out = await svc.attachCardhedgerFromPsaCert(meta, '83179580');
    expect(out).toBe(meta);
    expect(cardhedger.forwardJson).not.toHaveBeenCalled();
  });

  it('falls back to card-search when details-by-certs has card: null', async () => {
    const forwardJson = jest
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            cert_info: {
              cert: '83179580',
              description: "Misty's Gyarados 2025 Pokemon Destined Rivals",
            },
            card: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        cards: [
          {
            card_id: 'ch_from_search',
            description: "Misty's Gyarados 2025 Pokemon Destined Rivals",
            number: '49',
            image: 'https://cdn.example.com/big.webp',
          },
        ],
      });
    const svc = buildService(forwardJson);
    const meta = {
      properties: {
        graded: {
          psa: {
            certNumber: '83179580',
            cardNameHint: "Misty's Gyarados",
            cardNumberHint: '49',
          },
        },
      },
    };

    const out = await svc.attachCardhedgerFromPsaCert(meta, '83179580');
    const ch = (
      out.properties as { graded: { cardhedger: Record<string, string> } }
    ).graded.cardhedger;

    expect(ch.cardId).toBe('ch_from_search');
    expect(ch.imageUrl).toBe('https://cdn.example.com/big.webp');
    expect(forwardJson).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/v1/cards/card-search',
      expect.objectContaining({
        body: expect.objectContaining({
          search: "Misty's Gyarados 2025 Pokemon Destined Rivals",
        }),
      }),
    );
  });
});
