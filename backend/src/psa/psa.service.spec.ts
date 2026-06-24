import { ConfigService } from '@nestjs/config';
import { CardhedgerService } from '../cardhedger/cardhedger.service';
import { PsaPublicApiService } from './psa-public-api.service';
import { PsaService } from './psa.service';

describe('PsaService — Cardhedger cert OCR (Phase 5)', () => {
  const certLookupFixture = {
    cert_info: {
      grader: 'psa',
      cert: '76676185',
      grade: 'PSA 10',
      description: '2020 Pokemon VMAX',
    },
    card: {
      card_id: 'card-abc',
      description: 'Charizard VMAX 2020',
      image: 'https://cdn.example/card.jpg',
    },
    prices: [{ price: '125.50', Grade: 'PSA 10' }],
  };

  describe('mapCertLookupToOcrResolve', () => {
    it('maps cert, card, image, and headline price from CertLookupResponse', () => {
      const mapped = PsaService.mapCertLookupToOcrResolve(certLookupFixture, {
        certLookupComplete: true,
        priceSource: 'cardhedger_prices_by_cert_ocr',
      });
      expect(mapped?.certCandidates).toEqual(['76676185']);
      expect(mapped?.cardId).toBe('card-abc');
      expect(mapped?.searchQuery).toBe('Charizard VMAX 2020');
      expect(mapped?.imageUrl).toBe('https://cdn.example/card.jpg');
      expect(mapped?.priceUsd).toBe(125.5);
      expect(mapped?.priceSource).toBe('cardhedger_prices_by_cert_ocr');
      expect(mapped?.certLookupComplete).toBe(true);
    });

    it('returns null when response has no cert or card', () => {
      expect(
        PsaService.mapCertLookupToOcrResolve({ cert_info: {} }),
      ).toBeNull();
    });
  });

  describe('tryResolveByCardhedgerCertOcr', () => {
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    function serviceWithMocks(
      forwardJson: jest.Mock,
      pricesByCertOcrEnabled: boolean,
    ): PsaService {
      const cardhedger = {
        assertConfigured: () => undefined,
        forwardJson,
      } as unknown as CardhedgerService;
      const config = {
        get: (key: string) =>
          key === 'marketplace.cardhedgerFeatureFlags'
            ? { pricesByCertOcrEnabled }
            : undefined,
      } as unknown as ConfigService;
      return new PsaService(
        {} as PsaPublicApiService,
        cardhedger,
        config,
      );
    }

    it('uses prices-by-cert-ocr when flag is on', async () => {
      const forwardJson = jest.fn(async () => certLookupFixture);
      const svc = serviceWithMocks(forwardJson, true);
      const result = await (
        svc as unknown as {
          tryResolveByCardhedgerCertOcr: (b: Buffer) => Promise<unknown>;
        }
      ).tryResolveByCardhedgerCertOcr(tinyPng);

      expect(forwardJson).toHaveBeenCalledTimes(1);
      expect(forwardJson).toHaveBeenCalledWith(
        'POST',
        '/v1/cards/prices-by-cert-ocr',
        expect.objectContaining({
          body: expect.objectContaining({ image_base64: expect.any(String) }),
        }),
      );
      expect(result).toMatchObject({
        certCandidates: ['76676185'],
        cardId: 'card-abc',
        certLookupComplete: true,
        priceUsd: 125.5,
        priceSource: 'cardhedger_prices_by_cert_ocr',
      });
    });

    it('falls back to details-by-cert-ocr when prices path is empty', async () => {
      const forwardJson = jest
        .fn()
        .mockResolvedValueOnce({ cert_info: {} })
        .mockResolvedValueOnce(certLookupFixture);
      const svc = serviceWithMocks(forwardJson, true);
      const result = await (
        svc as unknown as {
          tryResolveByCardhedgerCertOcr: (b: Buffer) => Promise<unknown>;
        }
      ).tryResolveByCardhedgerCertOcr(tinyPng);

      expect(forwardJson).toHaveBeenCalledTimes(2);
      expect(forwardJson.mock.calls[0][1]).toBe('/v1/cards/prices-by-cert-ocr');
      expect(forwardJson.mock.calls[1][1]).toBe(
        '/v1/cards/details-by-cert-ocr',
      );
      expect(result).toMatchObject({
        cardId: 'card-abc',
      });
      expect(
        (result as { certLookupComplete?: boolean }).certLookupComplete,
      ).toBeUndefined();
    });

    it('uses details-by-cert-ocr only when flag is off', async () => {
      const forwardJson = jest.fn(async () => certLookupFixture);
      const svc = serviceWithMocks(forwardJson, false);
      await (
        svc as unknown as {
          tryResolveByCardhedgerCertOcr: (b: Buffer) => Promise<unknown>;
        }
      ).tryResolveByCardhedgerCertOcr(tinyPng);

      expect(forwardJson).toHaveBeenCalledTimes(1);
      expect(forwardJson).toHaveBeenCalledWith(
        'POST',
        '/v1/cards/details-by-cert-ocr',
        expect.any(Object),
      );
    });
  });
});
