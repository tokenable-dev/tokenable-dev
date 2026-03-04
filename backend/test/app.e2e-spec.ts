import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('e2e', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/auth (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/auth')
      .expect(200)
      .expect('hello world');
  });

  it('/api/nft (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/nft')
      .expect(200)
      .expect('hello world');
  });

  it('/api/util (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/util')
      .expect(200)
      .expect('hello world');
  });

  it('/api/blockchain (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/blockchain')
      .expect(200)
      .expect('hello world');
  });
});
