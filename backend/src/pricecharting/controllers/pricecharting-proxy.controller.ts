import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PRICECHARTING_SWAGGER_EXAMPLES } from '../pricecharting-swagger.examples';
import { PricechartingService } from '../pricecharting.service';

function pickQuery(
  query: Record<string, string | undefined>,
  keys: string[],
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) if (query[k] !== undefined) out[k] = query[k];
  return out;
}

/**
 * PriceCharting Prices proxy — Marketplace omitted (PC's own sell/ship/refund).
 * Token `t` is injected server-side from PRICECHARTING_API_TOKEN.
 *
 * Upstream hard limit is 1 JSON call/sec; CSV is once per 10 minutes.
 */
@Throttle({ default: { ttl: 60_000, limit: 30 } })
@ApiTags('pricecharting')
@Controller('pricecharting')
export class PricechartingProxyController {
  constructor(private readonly pricecharting: PricechartingService) {}

  @Get('product')
  @ApiOperation({
    summary: '단건 상품·가격 조회',
    description:
      'Upstream `GET /api/product`. CSV 한 행과 동일한 키 스키마.\n\n' +
      '**언제 쓰나:** cert/id로 한 장 확인, 캐시 miss 보강.\n\n' +
      '**가격 단위:** JSON은 pennies (정수). `$17.32` → `1732`.\n\n' +
      '`id` / `upc` / `q` 중 하나 필요. `t`는 서버가 주입합니다.',
  })
  @ApiQuery({
    name: 'id',
    required: false,
    description: 'PriceCharting product ID',
    example: PRICECHARTING_SWAGGER_EXAMPLES.productById.id,
  })
  @ApiQuery({
    name: 'upc',
    required: false,
    description: 'UPC barcode',
    example: '045496830434',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Full-text search (best single match)',
    example: PRICECHARTING_SWAGGER_EXAMPLES.productByQuery.q,
  })
  async getProduct(@Query() query: Record<string, string | undefined>) {
    return this.pricecharting.forwardJsonGet(
      '/api/product',
      pickQuery(query, ['id', 'upc', 'q']),
    );
  }

  @Get('products')
  @ApiOperation({
    summary: '상품 검색 (최대 20건)',
    description:
      'Upstream `GET /api/products`. `products` 배열로 최대 20건.\n\n' +
      '**언제 쓰나:** 이름 검색·매칭 실험. 페이지네이션 없음 — 전체 dump는 CSV.\n\n' +
      '`q` 필수. `t`는 서버가 주입합니다.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Full-text search',
    example: PRICECHARTING_SWAGGER_EXAMPLES.productsSearch.q,
  })
  async getProducts(@Query() query: Record<string, string | undefined>) {
    return this.pricecharting.forwardJsonGet(
      '/api/products',
      pickQuery(query, ['q']),
    );
  }

  @Get('csv')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({
    summary: 'Legendary CSV bulk 다운로드',
    description:
      '구독 페이지 API/Download URL(`PRICECHARTING_CSV_URL`)을 프록시합니다. ' +
      '공식 REST path는 없고, Legendary 전용입니다.\n\n' +
      '**언제 쓰나:** DB 전체 적재의 정본. 파일은 ~24h마다 갱신, **10분에 1회** 한도.\n\n' +
      'CSV 가격은 USD 소수 2자리(JSON pennies와 다름). 컬럼명은 Prices API 키와 동일.',
  })
  async getCsv(@Res() res: Response) {
    const { buffer, contentType, contentDisposition } =
      await this.pricecharting.forwardCsv();
    res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="pricecharting.csv"',
      );
    }
    res.send(buffer);
  }
}
