/**
 * api-1.json 기준 CardHedger 프록시 컨트롤러·Swagger 예시 재생성.
 * 실행: node scripts/generate-cardhedger-proxy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/api-1.json'), 'utf8'));

const CERT = '83179580';
const CARD_ID = '1586812246197x228181943611293700';
const CARD_ID_COMPS = '1587446850514x224832321163624450';

const KO = {
  '/v1/cards/top-movers': { s: '주간 상승률 상위 카드', d: '지난 1주일 가격 상승률이 높은 카드 목록입니다. 1시간 캐시.' },
  '/v1/cards/card-search': { s: '카드 검색', d: '검색어·세트·카테고리·선수 등으로 카드를 검색합니다.' },
  '/v1/cards/card-match': { s: 'AI 카드 매칭', d: '자연어 설명으로 가장 적합한 카드 1건과 신뢰도를 반환합니다.' },
  '/v1/cards/set-search': { s: '세트 검색', d: '카드 세트 이름·카테고리로 세트를 검색합니다.' },
  '/v1/cards/search-cards-wsort': { s: '정렬 포함 카드 검색', d: '전문 검색·필터·정렬·페이지네이션으로 카드를 검색합니다.' },
  '/v1/cards/card-details': { s: '카드 ID 상세 조회', d: 'card_id로 카드 상세 정보를 조회합니다.' },
  '/v1/cards/prices-by-cert': { s: 'cert 번호 가격 조회', d: 'PSA 등 grader cert 번호로 카드 정보와 가격을 조회합니다.' },
  '/v1/cards/batch-prices-by-cert': { s: 'cert 배치 가격 조회', d: '여러 cert 번호의 가격 추정치를 한 번에 조회합니다.' },
  '/v1/cards/prices-by-cert-ocr': { s: '슬랩 이미지 OCR 가격', d: '슬랩 사진에서 cert를 읽어 가격을 조회합니다.' },
  '/v1/cards/details-by-cert-ocr': { s: '슬랩 이미지 OCR 상세', d: '슬랩 사진에서 cert를 읽어 카드 상세를 조회합니다.' },
  '/v1/cards/details-by-certs': { s: 'cert 배치 상세 조회', d: '여러 cert 번호의 카드 상세를 한 번에 조회합니다.' },
  '/v1/cards/prices-by-card': { s: '카드 ID 가격 이력', d: 'card_id·등급별 가격 이력(기본 180일, 최대 365일)을 조회합니다.' },
  '/v1/cards/comps': { s: '비교 판매가 (COMPS)', d: '최근 거래 기반 비교 가격과 raw 거래 목록을 반환합니다.' },
  '/v1/cards/all-prices-by-card': { s: '전 등급 최신 가격', d: '카드의 모든 등급·그레이더별 최신 가격을 조회합니다.' },
  '/v1/cards/90day-prices-by-grade': { s: '등급별 90일 평균 가격', d: '특정 등급의 90일 평균 가격 카드 목록입니다.' },
  '/v1/cards/card-request': { s: '카드 등록 요청', d: '상업 계약이 있는 경우 신규 카드 등록을 요청합니다.' },
  '/v1/cards/price-updates': { s: '가격 변경 델타 조회', d: '지정 시각 이후 변경된 가격만 조회합니다(델타 폴링).' },
  '/v1/cards/price-estimate': { s: '가격 추정', d: '카드·등급의 가격 추정치를 조회합니다.' },
  '/v1/cards/batch-price-estimate': { s: '배치 가격 추정', d: '여러 카드의 가격 추정치를 한 번에 조회합니다.' },
  '/v1/cards/card-fmv': { s: '공정 시장가 (FMV)', d: '카드·등급의 FMV(신뢰도·불확실성 밴드 포함)를 조회합니다.' },
  '/v1/cards/card-fmv-batch': { s: 'FMV 배치 조회', d: '여러 카드·등급의 FMV를 한 번에 조회합니다.' },
  '/v1/cards/fmv-by-cert': { s: 'cert FMV 조회', d: 'cert 번호로 FMV를 조회합니다.' },
  '/v1/cards/subscribe-price-updates': { s: '가격 업데이트 구독', d: '가격 변경 웹훅/구독을 등록합니다.' },
  '/v1/cards/90day-prices-by-grade-search': { s: '90일 가격 검색', d: '90일 가격 데이터가 있는 카드를 검색합니다.' },
  '/v1/cards/additions-summary': { s: '신규 카탈로그 추가 요약', d: '기간별 신규 카탈로그 추가 통계입니다.' },
  '/v1/cards/total-sales-by-player': { s: '선수별 총 판매 건수', d: '선수별 누적 판매 건수를 조회합니다.' },
  '/v1/cards/sales-stats-by-player': { s: '선수별 판매 통계', d: '선수별 판매 건수·합계·평균 통계입니다.' },
  '/v1/cards/image-search': { s: '이미지 카드 검색', d: '카드 이미지로 유사 카드를 검색합니다.' },
  '/v1/cards/image-match': { s: '이미지 카드 식별', d: '이미지 한 장으로 카드를 식별합니다.' },
  '/v1/cards/issues': { s: '데이터 이슈', d: 'GET: 이슈 목록 · POST: 데이터 이슈 제출' },
  '/v1/cards/issues/{issue_id}': { s: '이슈 상세 조회', d: '제출한 데이터 이슈의 상세 내용을 조회합니다.' },
  '/v1/download/daily-price-export/{file_date}': { s: '일별 가격 CSV 다운로드', d: 'Elite/Enterprise 전용 일별 가격 CSV 파일입니다.' },
};

const QUERY_KO = {
  count: '반환할 카드 수',
  category: '카테고리 필터 (예: Baseball, Pokemon)',
  status: '이슈 상태 필터 (new, in_progress, resolved)',
};

const QUERY_EXAMPLES = { count: 10, category: 'Pokemon', status: 'new' };
const PATH_KO = { issue_id: '이슈 ID', file_date: '파일 날짜 (YYYY-MM-DD)' };
const PATH_EXAMPLES = { issue_id: 42, file_date: '2026-03-01' };

const BODY_OVERRIDES = {
  '/v1/cards/card-search': { search: 'Pikachu', category: 'Pokemon', page: 1, page_size: 10 },
  '/v1/cards/card-match': { query: '2023 Pokemon SV 151 Pikachu #173 PSA 10', category: 'Pokemon', max_candidates: 5 },
  '/v1/cards/set-search': { search: 'Pokemon 151', count: 10 },
  '/v1/cards/search-cards-wsort': { search: 'Pikachu', category: 'Pokemon', page: 1, page_size: 10 },
  '/v1/cards/card-details': { card_id: CARD_ID },
  '/v1/cards/prices-by-cert': { cert: CERT, grader: 'PSA' },
  '/v1/cards/batch-prices-by-cert': { certs: [CERT, '76676185'], grader: 'PSA' },
  '/v1/cards/details-by-certs': { certs: [CERT, '76676185'], grader: 'PSA' },
  '/v1/cards/prices-by-card': { card_id: CARD_ID, grade: 'PSA 10' },
  '/v1/cards/comps': { card_id: CARD_ID_COMPS, count: 10, grade: 'PSA 9' },
  '/v1/cards/all-prices-by-card': { card_id: CARD_ID },
  '/v1/cards/90day-prices-by-grade': { page: 1, page_size: 20, grade: 'PSA 10' },
  '/v1/cards/price-estimate': { card_id: CARD_ID, grade: 'PSA 10' },
  '/v1/cards/batch-price-estimate': { items: [{ card_id: CARD_ID, grade: 'PSA 10' }, { card_id: CARD_ID, grade: 'PSA 9' }] },
  '/v1/cards/card-fmv': { card_id: CARD_ID, grade: 'PSA 10' },
  '/v1/cards/card-fmv-batch': { items: [{ card_id: CARD_ID, grade: 'PSA 10' }, { card_id: CARD_ID, grade: 'PSA 9' }] },
  '/v1/cards/fmv-by-cert': { cert: CERT, grader: 'PSA' },
  '/v1/cards/90day-prices-by-grade-search': { search: 'Pikachu 151', grade: 'PSA 10' },
  '/v1/cards/additions-summary': { start_date: '2026-03-01' },
  '/v1/cards/total-sales-by-player': { players: ['Mike Trout'], days: 30 },
  '/v1/cards/sales-stats-by-player': { players: ['Mike Trout'], interval: 'week', periods: 12 },
  '/v1/cards/price-updates': { since: '2024-01-01T00:00:00.000Z' },
};

function firstExample(op) {
  const rb = op.requestBody?.content?.['application/json'];
  if (!rb) return null;
  if (rb.example) return structuredClone(rb.example);
  if (rb.examples) {
    const first = Object.values(rb.examples)[0];
    return structuredClone(first?.value ?? first);
  }
  return null;
}

function toHandlerName(method, upstreamPath) {
  const parts = upstreamPath.replace(/^\/v1\//, '').replace(/\{([^}]+)\}/g, 'By$1').split(/[\/-]/).filter(Boolean)
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)));
  const base = parts.join('');
  return method.toLowerCase() + base.charAt(0).toUpperCase() + base.slice(1);
}

const routes = [];
const examplesExport = {};

for (const [upstreamPath, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!['get', 'post'].includes(method)) continue;
    const m = method.toUpperCase();
    const queryParams = (op.parameters || []).filter((p) => p.in === 'query').map((p) => p.name);
    const pathParams = (upstreamPath.match(/\{([^}]+)\}/g) || []).map((x) => x.slice(1, -1));
    const ko = KO[upstreamPath] || { s: op.summary, d: 'Card Hedge upstream 프록시' };
    const bodyExample = BODY_OVERRIDES[upstreamPath] ?? firstExample(op);
    const key = upstreamPath.replace(/^\//, '').replace(/\{([^}]+)\}/g, '$1');
    const exampleKey = `${method}_${key.replace(/\//g, '_').replace(/-/g, '_')}`;
    if (bodyExample) examplesExport[exampleKey] = bodyExample;
    routes.push({
      method: m,
      upstreamPath,
      localPath: upstreamPath.replace(/^\//, ''),
      handler: toHandlerName(m, upstreamPath),
      summary: ko.s,
      description: ko.d,
      pathParams,
      queryParams,
      binary: upstreamPath.includes('/download/'),
      bodyExample,
      exampleKey,
    });
  }
}

const handlers = new Set();
for (const r of routes) {
  if (handlers.has(r.handler)) r.handler += r.method === 'GET' ? 'Get' : 'Post';
  handlers.add(r.handler);
}

function fmtExampleValue(key, val) {
  const json = JSON.stringify(val, null, 2);
  if (!json.includes(CERT)) return json.replace(/\n/g, '\n  ');
  return json
    .replaceAll(`"${CERT}"`, 'SWAGGER_FIXTURES.certNumber')
    .replace(/\n/g, '\n  ');
}

const exLines = Object.entries(examplesExport).map(
  ([k, v]) => `  ${k}: ${fmtExampleValue(k, v)},`,
);

fs.writeFileSync(
  path.join(ROOT, 'src/cardhedger/cardhedger-swagger.examples.ts'),
  `/** Card Hedge Swagger Try it out 기본값 (api-1.json + 로컬 fixtures) */
import { SWAGGER_FIXTURES } from '../swagger/fixtures';

export const CARDHEDGER_SWAGGER_EXAMPLES = {
${exLines.join('\n')}
} as const;

export const CARDHEDGER_QUERY_EXAMPLES = {
  count: 10,
  category: 'Pokemon',
  status: 'new',
} as const;

export const CARDHEDGER_PATH_EXAMPLES = {
  issue_id: 42,
  file_date: '2026-03-01',
} as const;
`,
);

function apiBodyLine(r) {
  if (!r.bodyExample || r.binary) return '';
  return `  @ApiBody({ schema: { type: 'object', additionalProperties: true }, description: '요청 본문', examples: { default: { summary: '기본 예시', value: CARDHEDGER_SWAGGER_EXAMPLES.${r.exampleKey} } } })`;
}

function methodImpl(r) {
  const dec = r.method === 'GET' ? '@Get' : '@Post';
  const lines = [
    `  ${dec}('${r.localPath}')`,
    `  @ApiOperation({ summary: ${JSON.stringify(r.summary)}, description: ${JSON.stringify(r.description)} })`,
  ];
  for (const p of r.pathParams) {
    lines.push(
      `  @ApiParam({ name: '${p}', required: true, description: ${JSON.stringify(PATH_KO[p] || '경로 파라미터')}, example: ${JSON.stringify(PATH_EXAMPLES[p] ?? '')} })`,
    );
  }
  for (const q of r.queryParams) {
    const ex = QUERY_EXAMPLES[q];
    const exPart = ex !== undefined ? `, example: ${JSON.stringify(ex)}` : '';
    lines.push(
      `  @ApiQuery({ name: '${q}', required: false, description: ${JSON.stringify(QUERY_KO[q] || '쿼리 파라미터')}${exPart} })`,
    );
  }
  const bodyLine = apiBodyLine(r);
  if (bodyLine) lines.push(bodyLine);

  const params = [];
  for (const p of r.pathParams) params.push(`@Param('${p}') ${p}: string`);
  if (r.queryParams.length) params.push(`@Query() query: Record<string, string | undefined>`);
  if (r.method === 'POST' && !r.binary) params.push(`@Body() body: Record<string, unknown>`);
  if (r.binary) params.push(`@Res() res: Response`);

  const upstreamExpr = r.pathParams.length
    ? '`' + r.upstreamPath.replace(/\{([^}]+)\}/g, (_, n) => '${' + n + '}') + '`'
    : `'${r.upstreamPath}'`;

  const body = [lines.join('\n'), `  async ${r.handler}(${params.join(', ')}) {`];
  if (r.binary) {
    body.push(`    const { buffer, contentType } = await this.cardhedger.forwardBinary(${upstreamExpr});`);
    body.push(`    res.setHeader('Content-Type', contentType);`);
    body.push(`    res.send(buffer);`);
  } else if (r.method === 'GET') {
    const q = r.queryParams.length ? `pickQuery(query, ${JSON.stringify(r.queryParams)})` : 'undefined';
    body.push(`    return this.cardhedger.forwardJson('GET', ${upstreamExpr}, { query: ${q} });`);
  } else {
    body.push(`    return this.cardhedger.forwardJson('POST', ${upstreamExpr}, { body });`);
  }
  body.push(`  }`);
  return body.join('\n');
}

const imports = `import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CARDHEDGER_SWAGGER_EXAMPLES } from '../cardhedger-swagger.examples';
import { CardhedgerService } from '../cardhedger.service';

function pickQuery(query: Record<string, string | undefined>, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) if (query[k] !== undefined) out[k] = query[k];
  return out;
}
`;

fs.writeFileSync(
  path.join(ROOT, 'src/cardhedger/controllers/cardhedger-proxy.controller.ts'),
  `${imports}
/** Card Hedge upstream 프록시 — api-1.json 전체 경로. API 키는 서버가 주입합니다. */
@ApiTags('cardhedger')
@Controller('cardhedger')
export class CardhedgerProxyController {
  constructor(private readonly cardhedger: CardhedgerService) {}

${routes.map(methodImpl).join('\n\n')}
}
`,
);

console.log(`Generated ${routes.length} routes, ${Object.keys(examplesExport).length} body examples`);
