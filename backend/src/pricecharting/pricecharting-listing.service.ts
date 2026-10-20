import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { CatalogCoverS3Service } from '../marketplace/collections/catalog-cover-s3.service';
import { PRICE_COLUMNS, PRICE_HEADER_TO_COLUMN } from './pricecharting-csv';

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function pricechartingListingPhotoObjectKey(
  prefix: string,
  listingId: string,
  photoId: string,
): string {
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const listing = listingId.trim().toLowerCase();
  const photo = photoId.trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(listing) || !/^[0-9a-f-]{36}$/.test(photo)) {
    throw new Error('listing photo id must be a uuid');
  }
  const key = `${base}pricecharting-listings/${listing}/${photo}`;
  if (
    key.endsWith('/cover') ||
    key.includes('/rwa-slabs/') ||
    !key.includes('/pricecharting-listings/')
  ) {
    throw new Error('listing photo key collides with an existing image path');
  }
  return key;
}

type ListingRow = {
  id: string;
  seller_user_id: string;
  pricecharting_product_id: string;
  client_request_id: string;
  ask_price_cents: number | null;
  quantity: number | null;
  sealed_status: string | null;
  condition_note: string | null;
  status: string;
  submitted_at: Date | null;
  created_at: Date;
  product_name?: string;
  console_name?: string;
  release_date?: string | null;
  loose_price_cents?: number | null;
};

type PhotoRow = {
  id: string;
  listing_id: string;
  object_key: string;
  public_url: string;
  sort_order: number;
};

export type ListingView = {
  id: string;
  sellerUserId: string;
  pricechartingProductId: string;
  productName: string | null;
  consoleName: string | null;
  releaseDate: string | null;
  loosePriceCents: number | null;
  askPriceCents: number | null;
  quantity: number | null;
  sealedStatus: string | null;
  conditionNote: string | null;
  status: string;
  photos: { id: string; publicUrl: string; sortOrder: number }[];
};

export type CatalogPriceRow = {
  column: string;
  label: string;
  cents: number;
};

export type CatalogListingDetail = ListingView & {
  genre: string | null;
  upc: string | null;
  salesVolume: number | null;
  tcgId: string | null;
  asin: string | null;
  epid: string | null;
  prices: CatalogPriceRow[];
  loosePriceHistory: { observedOn: string; loosePriceCents: number }[];
};

const PRICE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PRICE_HEADER_TO_COLUMN).map(([header, column]) => [
    column,
    header
      .split('-')
      .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
      .join(' '),
  ]),
);

export function visibleCatalogPrices(
  row: Record<string, unknown>,
): CatalogPriceRow[] {
  return PRICE_COLUMNS.flatMap((column) => {
    const raw = row[column];
    if (raw == null || raw === '') return [];
    const cents = Number(raw);
    if (!Number.isFinite(cents)) return [];
    return [{ column, label: PRICE_LABELS[column] ?? column, cents }];
  });
}

const LISTING_SELECT = `SELECT l.id, l.seller_user_id, l.pricecharting_product_id, l.client_request_id,
            l.ask_price_cents, l.quantity, l.sealed_status, l.condition_note, l.status,
            l.submitted_at, l.created_at,
            p.product_name, p.console_name,
            to_char(p.release_date, 'YYYY-MM-DD') AS release_date,
            p.loose_price_cents
     FROM pricecharting_listings l
     LEFT JOIN pricecharting_products p ON p.id = l.pricecharting_product_id`;

@Injectable()
export class PricechartingListingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly covers: CatalogCoverS3Service,
  ) {}

  async createDraft(input: {
    sellerUserId: string;
    pricechartingProductId: string;
    clientRequestId: string;
  }): Promise<ListingView> {
    const productId = input.pricechartingProductId.trim();
    const requestId = input.clientRequestId.trim();
    if (!productId || !requestId) {
      throw new BadRequestException('product id and clientRequestId are required');
    }
    const products = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM pricecharting_products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    if (!products.length) throw new NotFoundException('Catalog product not found');

    const id = randomUUID();
    const inserted = await this.dataSource.query<ListingRow[]>(
      `INSERT INTO pricecharting_listings
         (id, seller_user_id, pricecharting_product_id, client_request_id, status)
       VALUES ($1, $2, $3, $4, 'draft')
       ON CONFLICT (seller_user_id, client_request_id) DO NOTHING
       RETURNING id`,
      [id, input.sellerUserId, productId, requestId],
    );
    const listingId = inserted[0]?.id ?? (await this.existingId(input.sellerUserId, requestId));
    return this.getForSeller(input.sellerUserId, listingId);
  }

  async addPhoto(
    sellerUserId: string,
    listingId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<ListingView> {
    const listing = await this.requireOwner(sellerUserId, listingId);
    if (listing.status !== 'draft') {
      throw new BadRequestException('Photos can be added to a draft listing');
    }
    if (!file?.buffer?.length) throw new BadRequestException('Image file is required');
    const photoId = randomUUID();
    const key = pricechartingListingPhotoObjectKey(
      this.covers.getObjectKeyPrefix(),
      listing.id,
      photoId,
    );
    const put = await this.covers.putBytesAtKey(key, file.buffer, file.mimetype);
    const count = await this.dataSource.query<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM pricecharting_listing_photos WHERE listing_id = $1`,
      [listing.id],
    );
    await this.dataSource.query(
      `INSERT INTO pricecharting_listing_photos
         (id, listing_id, object_key, public_url, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [photoId, listing.id, put.objectKey, put.publicUrl, Number(count[0]?.n ?? 0)],
    );
    return this.getForSeller(sellerUserId, listing.id);
  }

  async submit(
    sellerUserId: string,
    listingId: string,
    input: {
      askPriceCents: number;
      quantity: number;
      sealedStatus: string;
      conditionNote?: string;
    },
  ): Promise<ListingView> {
    const listing = await this.requireOwner(sellerUserId, listingId);
    if (listing.status !== 'draft') {
      throw new BadRequestException('Only a draft listing can be submitted');
    }
    const photos = await this.photosFor([listing.id]);
    if (!photos.length) throw new BadRequestException('Upload a photo of the item before submitting');
    const sealedStatus = input.sealedStatus.trim();
    if (!sealedStatus) throw new BadRequestException('sealed status is required');
    const note = input.conditionNote?.trim() || null;
    await this.dataSource.query(
      `UPDATE pricecharting_listings
       SET ask_price_cents = $2,
           quantity = $3,
           sealed_status = $4,
           condition_note = $5,
           status = 'submitted',
           submitted_at = now()
       WHERE id = $1 AND seller_user_id = $6 AND status = 'draft'`,
      [
        listing.id,
        input.askPriceCents,
        input.quantity,
        sealedStatus,
        note,
        sellerUserId,
      ],
    );
    return this.getForSeller(sellerUserId, listing.id);
  }

  async cancel(sellerUserId: string, listingId: string): Promise<ListingView> {
    const listing = await this.requireOwner(sellerUserId, listingId);
    if (listing.status === 'cancelled') return this.toView(listing, await this.photosFor([listing.id]));
    await this.dataSource.query(
      `UPDATE pricecharting_listings SET status = 'cancelled' WHERE id = $1 AND seller_user_id = $2`,
      [listing.id, sellerUserId],
    );
    return this.getForSeller(sellerUserId, listing.id);
  }

  async listMine(sellerUserId: string): Promise<ListingView[]> {
    const rows = await this.dataSource.query<ListingRow[]>(
      `${LISTING_SELECT}
       WHERE l.seller_user_id = $1 AND l.status <> 'cancelled'
       ORDER BY l.created_at DESC`,
      [sellerUserId],
    );
    return this.withPhotos(rows);
  }

  async listSubmitted(): Promise<ListingView[]> {
    const rows = await this.dataSource.query<ListingRow[]>(
      `${LISTING_SELECT}
       WHERE l.status = 'submitted'
       ORDER BY l.submitted_at DESC NULLS LAST, l.created_at DESC
       LIMIT 100`,
    );
    return this.withPhotos(rows);
  }

  async getSubmitted(id: string): Promise<CatalogListingDetail> {
    const rows = await this.dataSource.query<ListingRow[]>(
      `${LISTING_SELECT} WHERE l.id = $1 AND l.status = 'submitted' LIMIT 1`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Listing not found');
    const photos = await this.photosFor([row.id]);
    const view = this.toView(row, photos);
    const [catalog, loosePriceHistory] = await Promise.all([
      this.catalogFor(view.pricechartingProductId),
      this.loosePriceHistory(view.pricechartingProductId),
    ]);
    return { ...view, ...catalog, loosePriceHistory };
  }

  private async catalogFor(productId: string): Promise<
    Omit<CatalogListingDetail, keyof ListingView | 'loosePriceHistory'>
  > {
    const empty = {
      genre: null,
      upc: null,
      salesVolume: null,
      tcgId: null,
      asin: null,
      epid: null,
      prices: [] as CatalogPriceRow[],
    };
    const columns = ['genre', 'upc', 'sales_volume', 'tcg_id', 'asin', 'epid', ...PRICE_COLUMNS];
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT ${columns.join(', ')} FROM pricecharting_products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    const row = rows[0];
    if (!row) return empty;
    return {
      genre: textOrNull(row.genre),
      upc: textOrNull(row.upc),
      salesVolume: numberOrNull(row.sales_volume),
      tcgId: textOrNull(row.tcg_id),
      asin: textOrNull(row.asin),
      epid: textOrNull(row.epid),
      prices: visibleCatalogPrices(row),
    };
  }

  private async loosePriceHistory(
    productId: string,
  ): Promise<{ observedOn: string; loosePriceCents: number }[]> {
    const rows = await this.dataSource.query<{ observed_on: string; loose_price_cents: number | null }[]>(
      `SELECT to_char(observed_on, 'YYYY-MM-DD') AS observed_on,
              (prices->>'loose_price_cents')::int AS loose_price_cents
       FROM pricecharting_price_history
       WHERE product_id = $1
       ORDER BY observed_on ASC`,
      [productId],
    );
    return rows.flatMap((row) => {
      if (row.loose_price_cents == null) return [];
      return [{ observedOn: row.observed_on, loosePriceCents: Number(row.loose_price_cents) }];
    });
  }

  private async existingId(sellerUserId: string, clientRequestId: string): Promise<string> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM pricecharting_listings
       WHERE seller_user_id = $1 AND client_request_id = $2
       LIMIT 1`,
      [sellerUserId, clientRequestId],
    );
    const id = rows[0]?.id;
    if (!id) throw new NotFoundException('Listing not found');
    return id;
  }

  private async getForSeller(sellerUserId: string, listingId: string): Promise<ListingView> {
    const row = await this.requireOwner(sellerUserId, listingId);
    return this.toView(row, await this.photosFor([row.id]));
  }

  private async requireOwner(sellerUserId: string, listingId: string): Promise<ListingRow> {
    const rows = await this.dataSource.query<ListingRow[]>(
      `${LISTING_SELECT} WHERE l.id = $1 LIMIT 1`,
      [listingId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Listing not found');
    if (row.seller_user_id !== sellerUserId) throw new ForbiddenException();
    return row;
  }

  private async withPhotos(rows: ListingRow[]): Promise<ListingView[]> {
    const photos = await this.photosFor(rows.map((row) => row.id));
    return rows.map((row) => this.toView(row, photos));
  }

  private async photosFor(listingIds: string[]): Promise<PhotoRow[]> {
    if (!listingIds.length) return [];
    return this.dataSource.query<PhotoRow[]>(
      `SELECT id, listing_id, object_key, public_url, sort_order
       FROM pricecharting_listing_photos
       WHERE listing_id = ANY($1::uuid[])
       ORDER BY sort_order ASC, created_at ASC`,
      [listingIds],
    );
  }

  private toView(row: ListingRow, photos: PhotoRow[]): ListingView {
    return {
      id: row.id,
      sellerUserId: row.seller_user_id,
      pricechartingProductId: row.pricecharting_product_id,
      productName: row.product_name ?? null,
      consoleName: row.console_name ?? null,
      releaseDate: row.release_date ?? null,
      loosePriceCents: row.loose_price_cents ?? null,
      askPriceCents: row.ask_price_cents,
      quantity: row.quantity,
      sealedStatus: row.sealed_status,
      conditionNote: row.condition_note,
      status: row.status,
      photos: photos
        .filter((photo) => photo.listing_id === row.id)
        .map((photo) => ({
          id: photo.id,
          publicUrl: photo.public_url,
          sortOrder: photo.sort_order,
        })),
    };
  }
}
