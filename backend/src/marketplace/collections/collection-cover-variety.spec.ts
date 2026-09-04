import { CollectionCoverService } from './collection-cover.service';

describe('CollectionCoverService.resolveCoverUrlFromMeta variety gate', () => {
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

  it('does not pick a high-scoring B&W sibling image for a Prism Refractor cover', async () => {
    // URL-quality rank used to prefer crop_image (80) over resize (25) even when
    // the crop was a different parallel — all Ohtani collections got one B&W cover.
    const bwCrop =
      'https://cdn.bubble.io/ohtani/black_white/crop_image';
    const prismResize =
      'https://cdn.bubble.io/ohtani/prism/resize';

    const forwardJson = jest.fn().mockImplementation(async (_m, path) => {
      if (path === '/v1/cards/card-details') {
        return {
          cards: [
            {
              card_id: 'ch_prism',
              variant: 'Pitching Prism Refractor',
              description: '2024 Topps Chrome Shohei Ohtani Prism Refractor',
              name: 'Shohei Ohtani',
              number: '150',
              image: prismResize,
            },
          ],
        };
      }
      if (path === '/v1/cards/card-search') {
        return {
          cards: [
            {
              card_id: 'ch_bw',
              variant: 'Black & White',
              description: '2024 Topps Chrome Shohei Ohtani Black & White',
              name: 'Shohei Ohtani',
              number: '150',
              set: '2024 Topps Chrome',
              image: bwCrop,
            },
            {
              card_id: 'ch_prism',
              variant: 'Pitching Prism Refractor',
              description: '2024 Topps Chrome Shohei Ohtani Prism Refractor',
              name: 'Shohei Ohtani',
              number: '150',
              set: '2024 Topps Chrome',
              image: prismResize,
            },
          ],
        };
      }
      return {};
    });

    const svc = buildService(forwardJson);
    const url = await svc.resolveCoverUrlFromMeta({
      properties: {
        graded: {
          psa: {
            Variety: 'PRISM REFRACTOR',
            cardNameHint: 'Shohei Ohtani',
            cardNumberHint: '150',
            setHint: '2024 Topps Chrome',
            year: '2024',
          },
          card: {
            name: 'Shohei Ohtani',
            number: '150',
            set: '2024 Topps Chrome',
            year: '2024',
            variant: 'Prism Refractor',
          },
          cardhedger: {
            cardId: 'ch_prism',
            imageUrl: prismResize,
            searchQuery: '2024 Topps Chrome Shohei Ohtani Prism Refractor 150',
          },
        },
      },
    });

    expect(url).toBe(prismResize);
    expect(url).not.toBe(bwCrop);
  });

  it('rejects parallel search images when PSA Variety is blank (flagship only)', async () => {
    const baseImg = 'https://cdn.bubble.io/ohtani/base/crop_image';
    const bwImg = 'https://cdn.bubble.io/ohtani/black_white/crop_image';

    const forwardJson = jest.fn().mockImplementation(async (_m, path) => {
      if (path === '/v1/cards/card-search') {
        return {
          cards: [
            {
              card_id: 'ch_bw',
              variant: 'Black & White',
              description: 'Shohei Ohtani Black & White',
              name: 'Shohei Ohtani',
              number: '150',
              set: '2024 Topps Chrome',
              image: bwImg,
            },
            {
              card_id: 'ch_base',
              variant: 'Base - Pitching',
              description: 'Shohei Ohtani Base Pitching',
              name: 'Shohei Ohtani',
              number: '150',
              set: '2024 Topps Chrome',
              image: baseImg,
            },
          ],
        };
      }
      return {};
    });

    const svc = buildService(forwardJson);
    const url = await svc.resolveCoverUrlFromMeta({
      properties: {
        graded: {
          psa: {
            Variety: '',
            cardNameHint: 'Shohei Ohtani',
            cardNumberHint: '150',
            setHint: '2024 Topps Chrome',
          },
          card: {
            name: 'Shohei Ohtani',
            number: '150',
            set: '2024 Topps Chrome',
          },
        },
      },
    });

    expect(url).toBe(baseImg);
  });
});
