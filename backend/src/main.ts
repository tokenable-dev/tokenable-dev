import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { swaggerUiOptions } from './swagger/swagger-ui.setup';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tokenable API')
    .setDescription(
      [
        '로컬: `http://localhost:4000/api/docs` · 모든 경로는 `/api` 접두사.',
        '',
        '**Try it out** — POST/PATCH 본문은 **「기본 예시」** 가 미리 채워져 있습니다. 파일 업로드(PSA·RWA)만 이미지를 직접 선택하세요.',
        '**인증** — 🔓 **Authorize** 에 JWT(또는 OAuth 후 `access_token` 쿠키와 동일한 Bearer).',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addServer('http://localhost:4000', 'Local')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('health', '헬스체크')
    .addTag('auth', 'OAuth · 세션 · 지갑')
    .addTag('blockchain', 'RWA·IPFS 읽기')
    .addTag('rwa', 'IPFS 업로드')
    .addTag('marketplace', '주문·컬렉션·포트폴리오')
    .addTag('cardhedger', '시장 지수')
    .addTag('psa', '슬랩·Cert·주문 진행')
    .addTag('admin', 'Cardhedger 운영 (관리자 지갑)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
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

  const port = config.get<number>('app.port') ?? 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on http://0.0.0.0:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
