import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { swaggerUiOptions } from './swagger/swagger-ui.setup';
import { buildSwaggerServers } from './swagger/swagger-servers.util';
import { sortSwaggerTagsPinFirst } from './swagger/swagger-tags.util';
import { assertSiteAccessConfig, readSiteAccessConfig } from './site-access/site-access.util';
import {
  assertMarketplaceAdminAuthConfig,
  readMarketplaceAdminAuthConfig,
} from './marketplace/admin/marketplace-admin-auth.util';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  assertSiteAccessConfig(readSiteAccessConfig(process.env));
  assertMarketplaceAdminAuthConfig(readMarketplaceAdminAuthConfig(process.env));
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);

  // Helmet must come before CORS so its headers don't override credential headers.
  // contentSecurityPolicy disabled to keep Swagger UI (inline scripts) working.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(compression());

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  const corsOrigin = config.get<string>('app.corsOrigin') ?? '*';
  const originList =
    corsOrigin === '*'
      ? null
      : corsOrigin
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);

  app.enableCors({
    origin:
      originList === null
        ? (
            origin: string | undefined,
            cb: (err: Error | null, allow?: boolean | string) => void,
          ) => cb(null, origin ?? true)
        : originList.length
          ? originList
          : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('app.port') ?? 4100;
  const isProduction = config.get<boolean>('app.isProduction') ?? false;
  const publicApiUrl = config.get<string | null>('app.publicApiUrl') ?? null;
  const swaggerServers = buildSwaggerServers({
    port,
    isProduction,
    publicApiUrl,
  });

  let swaggerBuilder = new DocumentBuilder()
    .setTitle('Tokenable API')
    .setDescription(
      [
        isProduction
          ? `배포 문서 — Try it out 요청은 **현재 호스트**(\`${swaggerServers[0]?.url === '/' ? 'same origin' : swaggerServers[0]?.url}\`)로 전송됩니다.`
          : `로컬 문서: \`http://localhost:${port}/api/docs\` · 모든 경로는 \`/api\` 접두사입니다.`,
        '',
        '### 빠른 테스트 순서',
        '1. **`GET /api/health`** — DB 연결 확인',
        '2. **`site-access`** — `SITE_ACCESS_ENABLED` 시 `POST /api/site-access/verify` (비밀번호 → 쿠키)',
        '3. **유저 JWT** — `POST /api/auth/privy/session` (`privy-access-token` Bearer) 또는 🔓 Authorize → `access-token`',
        '4. **`marketplace`** — 컬렉션·주문·포트폴리오·watchlist (본문은 **기본 예시** 자동 채움)',
        '5. **Admin** — `POST /api/marketplace/admin/auth/login` → `marketplace-admin` 태그 (쿠키 세션)',
        '',
        '**인증** — `access-token`: Tokenable JWT · `privy-access-token`: Privy `getAccessToken()` (세션 동기화·검증).',
        '**체인** — 선택 헤더 `x-tokenable-chain-id` (예: `80002`). marketplace 태그 대부분에 적용.',
        '**Privy 카탈로그** — `GET /api/privy/catalog` · 태그 `privy-auth` / `privy-users` / `privy-funding`.',
      ].join('\n'),
    )
    .setVersion('1.0');

  for (const server of swaggerServers) {
    swaggerBuilder = swaggerBuilder.addServer(server.url, server.description);
  }

  const swaggerConfig = swaggerBuilder
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Privy access token',
        in: 'header',
        description: 'From Privy `getAccessToken()` — not the Tokenable session JWT',
      },
      'privy-access-token',
    )
    .addTag(
      'site-access',
      '배포 게이트 — Swagger Try it out 전에 먼저 verify 호출 (쿠키 발급)',
    )
    .addTag('privy', 'Privy 기능 카탈로그 · 연동 상태 (`GET /privy/catalog`)')
    .addTag(
      'privy-auth',
      'Privy 로그인 → Tokenable 세션 · access token 검증',
    )
    .addTag('privy-users', 'Privy Users API 프록시 (서버 secret 필요)')
    .addTag(
      'privy-funding',
      '펀딩/on-ramp 설정 · Apple Pay · Google Pay는 클라이언트 useFiatOnramp (mainnet)',
    )
    .addTag('health', '헬스체크 — Swagger 테스트 1번')
    .addTag('blockchain', 'RWA·IPFS 읽기')
    .addTag('rwa', 'IPFS 업로드')
    .addTag(
      'marketplace',
      '주문·컬렉션·스냅샷·포트폴리오(holdings/cost basis)·watchlist',
    )
    .addTag(
      'marketplace-admin',
      '백오피스 — `POST /marketplace/admin/auth/login` 후 쿠키 세션',
    )
    .addTag(
      'cardhedger',
      'Card Hedge upstream 프록시 (`/api/cardhedger/v1/...`) — 서버가 API 키를 주입합니다. 전체 목록: `GET /api/cardhedger/routes`',
    )
    .addTag('cardladder', 'Card Ladder 대시보드 시장 지수')
    .addTag(
      'psa',
      'PSA Public API 6종 프록시 (cert·pop·order) + 슬랩 OCR analyze — upstream: `backend/src/psa/psa-swagger.json`',
    )
    .addTag('admin', 'Cardhedger 운영·헬스 (관리자 지갑)')
    .addTag('webhooks', 'Cardhedger price webhook (HMAC)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.tags = sortSwaggerTagsPinFirst(document.tags, [
    'site-access',
    'privy',
    'health',
    'privy-auth',
    'marketplace',
    'marketplace-admin',
  ]);
  SwaggerModule.setup('api/docs', app, document, swaggerUiOptions);

  const perfEnabled =
    process.env.PERF_LOG === 'true' || process.env.PERF_LOG === '1';
  const perfThreshold = Number(process.env.PERF_THRESHOLD_MS ?? '200');

  if (!isProduction || perfEnabled) {
    app.use(
      (
        req: { method: string; url?: string },
        res: { on: (ev: string, fn: () => void) => void; statusCode: number },
        next: () => void,
      ) => {
        const start = Date.now();
        const path = req.url?.split('?')[0] ?? req.url ?? '';
        res.on('finish', () => {
          const ms = Date.now() - start;
          if (!isProduction) {
            logger.log(`${req.method} ${path} ${res.statusCode} ${ms}ms`);
          }
          if (perfEnabled && ms >= perfThreshold) {
            process.stdout.write(
              JSON.stringify({
                perf: 'http',
                method: req.method,
                path,
                status: res.statusCode,
                ms,
              }) + '\n',
            );
          }
        });
        next();
      },
    );
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on http://127.0.0.1:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
