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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tokenable RWA API')
    .setDescription(
      [
        'RWA 마켓플레이스 백엔드 — 모든 HTTP 라우트는 **`/api`** 접두사 아래에 있습니다.',
        '이 문서 UI는 **`/api/docs`** (예: `http://localhost:4000/api/docs`).',
        '',
        '**인증**: 대부분의 `auth` 엔드포인트는 **HttpOnly 쿠키 `access_token`**(Google OAuth 후 발급) 또는 **`Authorization: Bearer`** 로 동작합니다. Swagger에서 보호된 라우트는 🔓 버튼으로 JWT를 넣을 수 있습니다.',
        '',
        '**Card Hedge**: 공개 HTTP는 `GET /api/cardhedger/indexes` 만; 나머지 Cardhedger 호출은 서버 내부 `CardhedgerService` 가 upstream 으로 직접 요청합니다 (`CARDHEDGER_API_KEY`).',
        '**경로 표**: Swagger `/api/docs` 및 레포 `docs/api/README.md`.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('auth', 'Google OAuth · JWT 쿠키 · 세션 · 지갑 연결')
    .addTag('rwa', 'RWA 메타데이터 multipart 업로드 → IPFS (Pinata)')
    .addTag(
      'blockchain',
      'Sepolia 읽기 전용 — TokenableRWA tokenURI · 메타데이터/IPFS 해소 · 미디어 URL 해소',
    )
    .addTag(
      'marketplace',
      'Seaport 오프체인 오더북 + 컬렉션·에셋 — 주문 등록·조회·체결 동기화',
    )
    .addTag(
      'cardhedger',
      'Card Hedge — `GET /cardhedger/indexes` (대시보드 인덱스 집계)',
    )
    .addTag('psa', '슬랩 이미지 OCR · PSA Public API')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  if (process.env.NODE_ENV !== 'production') {
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

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on http://0.0.0.0:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
