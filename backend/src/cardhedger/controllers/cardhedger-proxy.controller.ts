import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CARDHEDGER_SWAGGER_EXAMPLES } from '../cardhedger-swagger.examples';
import { CardhedgerService } from '../cardhedger.service';

function pickQuery(query: Record<string, string | undefined>, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) if (query[k] !== undefined) out[k] = query[k];
  return out;
}

/** Card Hedge upstream 프록시 — api-1.json 전체 경로. API 키는 서버가 주입합니다. */
@ApiTags('cardhedger')
@Controller('cardhedger')
export class CardhedgerProxyController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Get('v1/cards/top-movers')
  @ApiOperation({ summary: "주간 상승률 상위 카드", description: "지난 1주일 가격 상승률이 높은 카드 목록입니다. 1시간 캐시." })
  @ApiQuery({ name: 'count', required: false, description: "반환할 카드 수", example: 10 })
  @ApiQuery({ name: 'category', required: false, description: "카테고리 필터 (예: Baseball, Pokemon)", example: "Pokemon" })
  async getCardsTopMovers(@Query() query: Record<string, string | undefined>) {
    return this.cardhedger.forwardJson('GET', '/v1/cards/top-movers', { query: pickQuery(query, ["count","category"]) });
  }

  @Post('v1/cards/card-search')
  @ApiOperation({ summary: "카드 검색", description: "검색어·세트·카테고리·선수 등으로 카드를 검색합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_card_search } } })
  async postCardsCardSearch(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-search', { body });
  }

  @Post('v1/cards/card-match')
  @ApiOperation({ summary: "AI 카드 매칭", description: "자연어 설명으로 가장 적합한 카드 1건과 신뢰도를 반환합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_card_match } } })
  async postCardsCardMatch(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-match', { body });
  }

  @Post('v1/cards/set-search')
  @ApiOperation({ summary: "세트 검색", description: "카드 세트 이름·카테고리로 세트를 검색합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_set_search } } })
  async postCardsSetSearch(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/set-search', { body });
  }

  @Post('v1/cards/search-cards-wsort')
  @ApiOperation({ summary: "정렬 포함 카드 검색", description: "전문 검색·필터·정렬·페이지네이션으로 카드를 검색합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_search_cards_wsort } } })
  async postCardsSearchCardsWsort(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/search-cards-wsort', { body });
  }

  @Post('v1/cards/card-details')
  @ApiOperation({ summary: "카드 ID 상세 조회", description: "card_id로 카드 상세 정보를 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_card_details } } })
  async postCardsCardDetails(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-details', { body });
  }

  @Post('v1/cards/prices-by-cert')
  @ApiOperation({ summary: "cert 번호 가격 조회", description: "PSA 등 grader cert 번호로 카드 정보와 가격을 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_prices_by_cert } } })
  async postCardsPricesByCert(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/prices-by-cert', { body });
  }

  @Post('v1/cards/batch-prices-by-cert')
  @ApiOperation({ summary: "cert 배치 가격 조회", description: "여러 cert 번호의 가격 추정치를 한 번에 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_batch_prices_by_cert } } })
  async postCardsBatchPricesByCert(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/batch-prices-by-cert', { body });
  }

  @Post('v1/cards/prices-by-cert-ocr')
  @ApiOperation({ summary: "슬랩 이미지 OCR 가격", description: "슬랩 사진에서 cert를 읽어 가격을 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_prices_by_cert_ocr } } })
  async postCardsPricesByCertOcr(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/prices-by-cert-ocr', { body });
  }

  @Post('v1/cards/details-by-cert-ocr')
  @ApiOperation({ summary: "슬랩 이미지 OCR 상세", description: "슬랩 사진에서 cert를 읽어 카드 상세를 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_details_by_cert_ocr } } })
  async postCardsDetailsByCertOcr(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/details-by-cert-ocr', { body });
  }

  @Post('v1/cards/details-by-certs')
  @ApiOperation({ summary: "cert 배치 상세 조회", description: "여러 cert 번호의 카드 상세를 한 번에 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_details_by_certs } } })
  async postCardsDetailsByCerts(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/details-by-certs', { body });
  }

  @Post('v1/cards/prices-by-card')
  @ApiOperation({ summary: "카드 ID 가격 이력", description: "card_id·등급별 가격 이력(기본 180일, 최대 365일)을 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_prices_by_card } } })
  async postCardsPricesByCard(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/prices-by-card', { body });
  }

  @Post('v1/cards/comps')
  @ApiOperation({ summary: "비교 판매가 (COMPS)", description: "최근 거래 기반 비교 가격과 raw 거래 목록을 반환합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_comps } } })
  async postCardsComps(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/comps', { body });
  }

  @Post('v1/cards/all-prices-by-card')
  @ApiOperation({ summary: "전 등급 최신 가격", description: "카드의 모든 등급·그레이더별 최신 가격을 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_all_prices_by_card } } })
  async postCardsAllPricesByCard(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/all-prices-by-card', { body });
  }

  @Post('v1/cards/90day-prices-by-grade')
  @ApiOperation({ summary: "등급별 90일 평균 가격", description: "특정 등급의 90일 평균 가격 카드 목록입니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_90day_prices_by_grade } } })
  async postCards90dayPricesByGrade(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/90day-prices-by-grade', { body });
  }

  @Post('v1/cards/card-request')
  @ApiOperation({ summary: "카드 등록 요청", description: "상업 계약이 있는 경우 신규 카드 등록을 요청합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_card_request } } })
  async postCardsCardRequest(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-request', { body });
  }

  @Post('v1/cards/price-updates')
  @ApiOperation({ summary: "가격 변경 델타 조회", description: "지정 시각 이후 변경된 가격만 조회합니다(델타 폴링)." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_price_updates } } })
  async postCardsPriceUpdates(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/price-updates', { body });
  }

  @Post('v1/cards/price-estimate')
  @ApiOperation({ summary: "가격 추정", description: "카드·등급의 가격 추정치를 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_price_estimate } } })
  async postCardsPriceEstimate(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/price-estimate', { body });
  }

  @Post('v1/cards/batch-price-estimate')
  @ApiOperation({ summary: "배치 가격 추정", description: "여러 카드의 가격 추정치를 한 번에 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_batch_price_estimate } } })
  async postCardsBatchPriceEstimate(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/batch-price-estimate', { body });
  }

  @Post('v1/cards/card-fmv')
  @ApiOperation({ summary: "공정 시장가 (FMV)", description: "카드·등급의 FMV(신뢰도·불확실성 밴드 포함)를 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_card_fmv } } })
  async postCardsCardFmv(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-fmv', { body });
  }

  @Post('v1/cards/card-fmv-batch')
  @ApiOperation({ summary: "FMV 배치 조회", description: "여러 카드·등급의 FMV를 한 번에 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_card_fmv_batch } } })
  async postCardsCardFmvBatch(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-fmv-batch', { body });
  }

  @Post('v1/cards/fmv-by-cert')
  @ApiOperation({ summary: "cert FMV 조회", description: "cert 번호로 FMV를 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_fmv_by_cert } } })
  async postCardsFmvByCert(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/fmv-by-cert', { body });
  }

  @Post('v1/cards/subscribe-price-updates')
  @ApiOperation({ summary: "가격 업데이트 구독", description: "가격 변경 웹훅/구독을 등록합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_subscribe_price_updates } } })
  async postCardsSubscribePriceUpdates(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/subscribe-price-updates', { body });
  }

  @Post('v1/cards/90day-prices-by-grade-search')
  @ApiOperation({ summary: "90일 가격 검색", description: "90일 가격 데이터가 있는 카드를 검색합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_90day_prices_by_grade_search } } })
  async postCards90dayPricesByGradeSearch(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/90day-prices-by-grade-search', { body });
  }

  @Post('v1/cards/additions-summary')
  @ApiOperation({ summary: "신규 카탈로그 추가 요약", description: "기간별 신규 카탈로그 추가 통계입니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_additions_summary } } })
  async postCardsAdditionsSummary(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/additions-summary', { body });
  }

  @Post('v1/cards/total-sales-by-player')
  @ApiOperation({ summary: "선수별 총 판매 건수", description: "선수별 누적 판매 건수를 조회합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_total_sales_by_player } } })
  async postCardsTotalSalesByPlayer(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/total-sales-by-player', { body });
  }

  @Post('v1/cards/sales-stats-by-player')
  @ApiOperation({ summary: "선수별 판매 통계", description: "선수별 판매 건수·합계·평균 통계입니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_sales_stats_by_player } } })
  async postCardsSalesStatsByPlayer(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/sales-stats-by-player', { body });
  }

  @Post('v1/cards/image-search')
  @ApiOperation({ summary: "이미지 카드 검색", description: "카드 이미지로 유사 카드를 검색합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_image_search } } })
  async postCardsImageSearch(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/image-search', { body });
  }

  @Post('v1/cards/image-match')
  @ApiOperation({ summary: "이미지 카드 식별", description: "이미지 한 장으로 카드를 식별합니다." })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_image_match } } })
  async postCardsImageMatch(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/image-match', { body });
  }

  @Post('v1/cards/issues')
  @ApiOperation({ summary: "데이터 이슈", description: "GET: 이슈 목록 · POST: 데이터 이슈 제출" })
  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.post_v1_cards_issues } } })
  async postCardsIssues(@Body() body: Record<string, unknown>) {
    return this.cardhedger.forwardJson('POST', '/v1/cards/issues', { body });
  }

  @Get('v1/cards/issues')
  @ApiOperation({ summary: "데이터 이슈", description: "GET: 이슈 목록 · POST: 데이터 이슈 제출" })
  @ApiQuery({ name: 'status', required: false, description: "이슈 상태 필터 (new, in_progress, resolved)", example: "new" })
  async getCardsIssues(@Query() query: Record<string, string | undefined>) {
    return this.cardhedger.forwardJson('GET', '/v1/cards/issues', { query: pickQuery(query, ["status"]) });
  }

  @Get('v1/cards/issues/{issue_id}')
  @ApiOperation({ summary: "이슈 상세 조회", description: "제출한 데이터 이슈의 상세 내용을 조회합니다." })
  @ApiParam({ name: 'issue_id', required: true, description: "이슈 ID", example: 42 })
  async getCardsIssuesByissue_id(@Param('issue_id') issue_id: string) {
    return this.cardhedger.forwardJson('GET', `/v1/cards/issues/${issue_id}`, { query: undefined });
  }

  @Get('v1/download/daily-price-export/{file_date}')
  @ApiOperation({ summary: "일별 가격 CSV 다운로드", description: "Elite/Enterprise 전용 일별 가격 CSV 파일입니다." })
  @ApiParam({ name: 'file_date', required: true, description: "파일 날짜 (YYYY-MM-DD)", example: "2026-03-01" })
  async getDownloadDailyPriceExportByfile_date(@Param('file_date') file_date: string, @Res() res: Response) {
    const { buffer, contentType } = await this.cardhedger.forwardBinary(`/v1/download/daily-price-export/${file_date}`);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }
}
