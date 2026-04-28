import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  const originList =
    corsOrigin === '*'
      ? null
      : corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);

  app.enableCors({
    origin:
      originList === null
        ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean | string) => void) =>
            cb(null, origin ?? true)
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tokenable RWA API')
    .setDescription(
      [
        'RWA 마켓플레이스 백엔드 — 모든 HTTP 라우트는 **`/api`** 접두사 아래에 있습니다.',
        '이 문서 UI는 **`/api/docs`** (예: `http://localhost:4000/api/docs`).',
        '',
        '**인증**: 대부분의 `auth` 엔드포인트는 **HttpOnly 쿠키 `access_token`**(Google OAuth 후 발급) 또는 **`Authorization: Bearer`** 로 동작합니다. Swagger에서 보호된 라우트는 🔓 버튼으로 JWT를 넣을 수 있습니다.',
        '',
        '**Card Hedge**: `GET /api/cardhedger/catalog` — 연산 목록; `GET /api/cardhedger/indexes` 대시보드 인덱스 집계; 세부 엔드포인트는 Swagger 태그 **Card Hedge · …** (`CARDHEDGER_API_KEY`).',
        '**Cardhedger only**: marketplace external pricing routes are unified to Cardhedger endpoints.',
        '**전체 경로 표**: 레포 `docs/API-REFERENCE.md` (Swagger `/api/docs`와 병행).',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('auth', 'Google OAuth · JWT 쿠키 · 세션 · 지갑 연결')
    .addTag('rwa', 'RWA 메타데이터 multipart 업로드 → IPFS (Pinata)')
    .addTag('blockchain', 'Sepolia 읽기 전용 — USDC · Tokenable_RWA')
    .addTag(
      'marketplace',
      'Seaport 오프체인 오더북 + 컬렉션 — 주문 등록·조회·체결 동기화; 규칙 매칭(bids/trade/match) 병행',
    )
    .addTag(
      'cardhedger',
      'Card Hedge — catalog (`GET /cardhedger/catalog`)',
    )
    .addTag('psa', '슬랩 이미지 OCR · PSA Public API')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
