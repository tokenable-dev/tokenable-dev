import type { DataSource } from 'typeorm';
import type { CatalogCoverS3Service } from '../marketplace/collections/catalog-cover-s3.service';
import {
  PricechartingListingService,
  pricechartingListingPhotoObjectKey,
  visibleCatalogPrices,
} from './pricecharting-listing.service';

describe('catalog price rows', () => {
  it('keeps every stored cent column and drops blanks', () => {
    expect(
      visibleCatalogPrices({
        loose_price_cents: 26128,
        condition_19_price_cents: null,
        new_price_cents: 0,
      }),
    ).toEqual([
      { column: 'loose_price_cents', label: 'Loose Price', cents: 26128 },
      { column: 'new_price_cents', label: 'New Price', cents: 0 },
    ]);
  });
});

describe('pricecharting listing photo keys', () => {
  it('uses a listing folder and not a collection cover or slab key', () => {
    const listingId = '11111111-1111-4111-8111-111111111111';
    const photoId = '22222222-2222-4222-8222-222222222222';
    const key = pricechartingListingPhotoObjectKey('covers/', listingId, photoId);
    expect(key).toBe(`covers/pricecharting-listings/${listingId}/${photoId}`);
    expect(key.endsWith('/cover')).toBe(false);
    expect(key.includes('/rwa-slabs/')).toBe(false);
  });
});

describe('pricecharting seller listing flow', () => {
  it('returns the existing draft for the same client request and keeps ask price separate', async () => {
    const listings = new Map<string, Record<string, unknown>>();
    const photos: Record<string, unknown>[] = [];
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM pricecharting_products')) {
        return params[0] === '5490667' ? [{ id: '5490667' }] : [];
      }
      if (sql.includes('INSERT INTO pricecharting_listings')) {
        const key = `${params[1]}:${params[3]}`;
        if ([...listings.values()].some((row) => row.key === key)) return [];
        listings.set(String(params[0]), {
          key,
          id: params[0],
          seller_user_id: params[1],
          pricecharting_product_id: params[2],
          client_request_id: params[3],
          ask_price_cents: null,
          quantity: null,
          sealed_status: null,
          condition_note: null,
          status: 'draft',
          product_name: 'Pokemon Japanese Scarlet & Violet 151',
          console_name: 'Booster Box',
          release_date: '2023-06-16',
          loose_price_cents: 26128,
        });
        return [{ id: params[0] }];
      }
      if (sql.includes('WHERE seller_user_id = $1 AND client_request_id = $2')) {
        const found = [...listings.values()].find(
          (row) => row.seller_user_id === params[0] && row.client_request_id === params[1],
        );
        return found ? [{ id: found.id }] : [];
      }
      if (sql.includes('WHERE l.id = $1')) {
        const found = listings.get(String(params[0]));
        return found ? [found] : [];
      }
      if (sql.includes('FROM pricecharting_listing_photos')) return photos;
      throw new Error(sql.slice(0, 80));
    });
    const covers = {
      getObjectKeyPrefix: () => 'covers/',
      putBytesAtKey: jest.fn(),
    };
    const service = new PricechartingListingService(
      { query } as unknown as DataSource,
      covers as unknown as CatalogCoverS3Service,
    );
    const first = await service.createDraft({
      sellerUserId: 'user-1',
      pricechartingProductId: '5490667',
      clientRequestId: 'request-1',
    });
    const second = await service.createDraft({
      sellerUserId: 'user-1',
      pricechartingProductId: '5490667',
      clientRequestId: 'request-1',
    });
    expect(second.id).toBe(first.id);
    expect(listings.size).toBe(1);
    expect(first.loosePriceCents).toBe(26128);
    expect(first.askPriceCents).toBeNull();
    expect(covers.putBytesAtKey).not.toHaveBeenCalled();
  });

  it('stores the asking price apart from loose price and a non-cover photo key', async () => {
    const listings = new Map<string, Record<string, unknown>>();
    const photos: Record<string, unknown>[] = [];
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM pricecharting_products WHERE id')) {
        return params[0] === '5490667'
          ? [{ id: '5490667', loose_price_cents: 26128 }]
          : [];
      }
      if (sql.includes('INSERT INTO pricecharting_listings')) {
        listings.set(String(params[0]), {
          id: params[0],
          seller_user_id: params[1],
          pricecharting_product_id: params[2],
          client_request_id: params[3],
          ask_price_cents: null,
          quantity: null,
          sealed_status: null,
          condition_note: null,
          status: 'draft',
          product_name: 'Booster Box',
          console_name: 'Pokemon Japanese Scarlet & Violet 151',
          release_date: '2023-06-16',
          loose_price_cents: 26128,
        });
        return [{ id: params[0] }];
      }
      if (sql.includes('COUNT(*)')) {
        return [{ n: photos.filter((photo) => photo.listing_id === params[0]).length }];
      }
      if (sql.includes('INSERT INTO pricecharting_listing_photos')) {
        photos.push({
          id: params[0],
          listing_id: params[1],
          object_key: params[2],
          public_url: params[3],
          sort_order: params[4],
        });
        return [];
      }
      if (sql.includes('SET ask_price_cents')) {
        const row = listings.get(String(params[0]));
        if (row && row.seller_user_id === params[5] && row.status === 'draft') {
          row.ask_price_cents = params[1];
          row.quantity = params[2];
          row.sealed_status = params[3];
          row.condition_note = params[4];
          row.status = 'submitted';
        }
        return [];
      }
      if (sql.includes("SET status = 'cancelled'")) {
        const row = listings.get(String(params[0]));
        if (row && row.seller_user_id === params[1]) row.status = 'cancelled';
        return [];
      }
      if (sql.includes('WHERE l.id = $1 AND l.status')) {
        const row = listings.get(String(params[0]));
        return row && row.status === 'submitted' ? [row] : [];
      }
      if (sql.includes('WHERE l.id = $1')) {
        const row = listings.get(String(params[0]));
        return row ? [row] : [];
      }
      if (sql.includes('listing_id = ANY')) {
        const ids = params[0] as string[];
        return photos.filter((photo) => ids.includes(String(photo.listing_id)));
      }
      if (sql.includes('seller_user_id = $1 AND l.status')) {
        return [...listings.values()].filter(
          (row) => row.seller_user_id === params[0] && row.status !== 'cancelled',
        );
      }
      if (sql.includes("l.status = 'submitted'")) {
        return [...listings.values()].filter((row) => row.status === 'submitted');
      }
      throw new Error(sql.slice(0, 100));
    });
    const covers = {
      getObjectKeyPrefix: () => 'covers/',
      putBytesAtKey: jest.fn(async (key: string) => ({
        objectKey: key,
        publicUrl: `https://cdn.example/${key}`,
      })),
      uploadCollectionCover: jest.fn(),
    };
    const service = new PricechartingListingService(
      { query } as unknown as DataSource,
      covers as unknown as CatalogCoverS3Service,
    );
    const draft = await service.createDraft({
      sellerUserId: 'user-1',
      pricechartingProductId: '5490667',
      clientRequestId: 'request-2',
    });
    await expect(
      service.submit('user-1', draft.id, {
        askPriceCents: 30000,
        quantity: 1,
        sealedStatus: 'Factory sealed',
      }),
    ).rejects.toThrow('Upload a photo');
    await expect(
      service.addPhoto('user-2', draft.id, {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        size: 3,
      }),
    ).rejects.toThrow();

    const withPhoto = await service.addPhoto('user-1', draft.id, {
      buffer: Buffer.from('img'),
      mimetype: 'image/jpeg',
      size: 3,
    });
    const key = covers.putBytesAtKey.mock.calls[0]?.[0] as string;
    expect(key).toContain(`/pricecharting-listings/${draft.id}/`);
    expect(key.endsWith('/cover')).toBe(false);
    expect(key.includes('/rwa-slabs/')).toBe(false);
    expect(covers.uploadCollectionCover).not.toHaveBeenCalled();
    expect(withPhoto.loosePriceCents).toBe(26128);
    expect(withPhoto.askPriceCents).toBeNull();

    const submitted = await service.submit('user-1', draft.id, {
      askPriceCents: 30000,
      quantity: 2,
      sealedStatus: 'Factory sealed',
    });
    expect(submitted.status).toBe('submitted');
    expect(submitted.askPriceCents).toBe(30000);
    expect(submitted.loosePriceCents).toBe(26128);
    expect(await service.listSubmitted()).toEqual([
      expect.objectContaining({ id: draft.id, askPriceCents: 30000 }),
    ]);

    await service.cancel('user-1', draft.id);
    expect(await service.listMine('user-1')).toEqual([]);
    expect(await service.listSubmitted()).toEqual([]);
  });
});
