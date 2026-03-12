import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PriceService } from './price.service';
import { GetSetsDto } from './dto/get-sets.dto';
import { GetCardsDto } from './dto/get-cards.dto';
import { BatchCardsDto } from './dto/batch-cards.dto';

@ApiTags('price')
@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  // ── GET /price/games ─────────────────────────────────────────
  @ApiOperation({
    summary: '지원 게임 목록 조회',
    description: `JustTCG가 지원하는 모든 TCG 게임 목록을 반환합니다.
    
포함 게임: Magic: The Gathering, Pokémon, Yu-Gi-Oh!, Disney Lorcana, One Piece TCG, Digimon, Union Arena 등.

각 게임별로 카드/변형/봉인 제품 수, 7d/30d/90d 가격 변동률 및 가격 상승/하락 카드 수 통계를 포함합니다.`,
  })
  @ApiResponse({ status: 200, description: '게임 목록 반환 성공' })
  @ApiResponse({ status: 401, description: 'API 키 인증 실패' })
  @Get('games')
  getGames(): Promise<unknown> {
    return this.priceService.getGames();
  }

  // ── GET /price/sets ──────────────────────────────────────────
  @ApiOperation({
    summary: '세트 목록 조회',
    description: `특정 게임의 세트 목록을 조회합니다.

**game 파라미터 필수.** 지원 game ID 목록:
\`mtg\`, \`magic-the-gathering\`, \`pokemon\`, \`yugioh\`, \`disney-lorcana\`, \`one-piece-card-game\`, \`digimon-card-game\`, \`union-arena\`, \`flesh-and-blood-tcg\`

각 세트별로 카드 수, 총 가치(USD), 7d/30d/90d 가치 변동률을 포함합니다.`,
  })
  @ApiResponse({ status: 200, description: '세트 목록 반환 성공' })
  @ApiResponse({ status: 400, description: '잘못된 파라미터 (game 미입력 등)' })
  @ApiResponse({ status: 401, description: 'API 키 인증 실패' })
  @Get('sets')
  getSets(@Query() dto: GetSetsDto): Promise<unknown> {
    return this.priceService.getSets(dto);
  }

  // ── GET /price/cards ─────────────────────────────────────────
  @ApiOperation({
    summary: '카드 단건 조회 / 검색',
    description: `**직접 조회 모드**: 식별자(tcgplayerId, cardId, variantId 등) 전달 시 해당 카드를 정확히 조회합니다.
    
**검색 모드**: 식별자 없이 \`q\` / \`game\` / \`set\` 파라미터로 카드를 검색합니다.

식별자 우선순위: \`variantId\` > \`tcgplayerSkuId\` > \`tcgplayerId\` > \`mtgjsonId\` > \`scryfallId\` > \`cardId\`

각 카드의 variants 배열에 condition(상태), printing(인쇄 타입), 현재 가격 및 가격 히스토리가 포함됩니다.`,
  })
  @ApiQuery({ name: 'tcgplayerId', required: false, example: '219042' })
  @ApiQuery({ name: 'cardId', required: false })
  @ApiQuery({ name: 'variantId', required: false })
  @ApiQuery({ name: 'q', required: false, example: 'Charizard' })
  @ApiQuery({ name: 'game', required: false, example: 'pokemon' })
  @ApiQuery({ name: 'set', required: false })
  @ApiQuery({ name: 'printing', required: false, example: 'Normal' })
  @ApiQuery({ name: 'condition', required: false, example: 'NM,LP' })
  @ApiQuery({
    name: 'priceHistoryDuration',
    required: false,
    enum: ['7d', '30d', '90d', '180d'],
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiResponse({ status: 200, description: '카드 데이터 반환 성공' })
  @ApiResponse({ status: 400, description: '잘못된 파라미터' })
  @ApiResponse({ status: 401, description: 'API 키 인증 실패' })
  @ApiResponse({ status: 404, description: '카드를 찾을 수 없음' })
  @Get('cards')
  getCards(@Query() dto: GetCardsDto): Promise<unknown> {
    return this.priceService.getCards(dto);
  }

  // ── POST /price/cards/batch ──────────────────────────────────
  @ApiOperation({
    summary: '카드 배치 조회',
    description: `여러 카드의 가격 정보를 단일 요청으로 조회합니다.

**플랜별 최대 허용 수**: 무료 20개, Starter/Pro 100개, Enterprise 200개

각 항목에 식별자(tcgplayerId, cardId, variantId 등)와 printing/condition 필터를 개별 지정할 수 있습니다.

식별자 우선순위: \`variantId\` > \`tcgplayerSkuId\` > \`tcgplayerId\` > \`mtgjsonId\` > \`scryfallId\` > \`cardId\``,
  })
  @ApiBody({
    type: BatchCardsDto,
    examples: {
      'tcgplayerId 기반': {
        value: {
          items: [
            { tcgplayerId: '219042', condition: 'NM', printing: 'Normal' },
            { tcgplayerId: '25788', condition: 'LP' },
          ],
        },
      },
      'cardId 기반': {
        value: {
          items: [
            {
              cardId:
                'pokemon-battle-academy-fire-energy-22-charizard-stamped',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '배치 카드 데이터 반환 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 또는 한도 초과' })
  @ApiResponse({ status: 401, description: 'API 키 인증 실패' })
  @Post('cards/batch')
  batchCards(@Body() dto: BatchCardsDto): Promise<unknown> {
    return this.priceService.batchCards(dto.items);
  }
}
