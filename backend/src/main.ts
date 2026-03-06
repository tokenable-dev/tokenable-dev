import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
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
    .setTitle('NFT Marketplace API')
    .setDescription('NFT Marketplace 백엔드 API 문서')
    .setVersion('1.0')
    .addTag('auth', '인증')
    .addTag('nft', 'NFT')
    .addTag('blockchain', '블록체인 / 토큰')
    .addTag('util', '유틸리티')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
