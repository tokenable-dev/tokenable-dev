import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
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
  const config = app.get(ConfigService);

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
        '**실행(Try it out)** — POST/PATCH 본문은 **「기본 예시」** 가 미리 채워져 있습니다. PSA·RWA 파일 업로드만 이미지를 직접 선택하세요.',
        '**인증** — 🔓 **Authorize** 에 JWT를 넣거나, OAuth 로그인 후 발급된 `access_token` 쿠키와 동일한 Bearer 토큰을 사용하세요.',
        '**Site access** — `SITE_ACCESS_ENABLED` 시 먼저 `POST /api/site-access/verify` 로 비밀번호를 제출해 쿠키를 받은 뒤 Try it out 하세요 (동일 origin, 쿠키 자동 전송).',
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
    .addTag(
      'site-access',
      '배포 게이트 — Swagger Try it out 전에 먼저 verify 호출 (쿠키 발급)',
    )
    .addTag('health', '헬스체크')
    .addTag('auth', 'OAuth · 세션 · 지갑')
    .addTag('blockchain', 'RWA·IPFS 읽기')
    .addTag('rwa', 'IPFS 업로드')
    .addTag('marketplace', '주문·컬렉션·포트폴리오')
    .addTag(
      'cardhedger',
      'Card Hedge upstream 프록시 (`/api/cardhedger/v1/...`) — 서버가 API 키를 주입합니다. 전체 목록: `GET /api/cardhedger/routes`',
    )
    .addTag('cardladder', 'Card Ladder 대시보드 시장 지수')
    .addTag('psa', 'PSA 슬랩·Cert·주문 진행')
    .addTag('admin', 'Cardhedger 운영·헬스 (관리자 지갑)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.tags = sortSwaggerTagsPinFirst(document.tags, 'site-access');
  SwaggerModule.setup('api/docs', app, document, swaggerUiOptions);

  if (!config.get<boolean>('app.isProduction')) {
    app.use(
      (
        req: { method: string; url?: string },
        res: { on: (ev: string, fn: () => void) => void; statusCode: number },
        next: () => void,
      ) => {
        const start = Date.now();
        const path = req.url?.split('?')[0] ?? req.url ?? '';
        res.on('finish', () => {
          logger.log(
            `${req.method} ${path} ${res.statusCode} ${Date.now() - start}ms`,
          );
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
