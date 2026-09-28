import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import helmet from 'helmet';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { originCheck } from './common/origin-check';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  // 리버스 프록시(Nginx 등) 뒤에서 실행: X-Forwarded-* 헤더를 신뢰해야
  // req.secure/req.ip 가 정확해진다. 이게 없으면 secure 쿠키(세션)가
  // "연결이 안전하지 않다"고 판단해 조용히 Set-Cookie 를 생략한다
  // (express-session 의 issecure() 가 trust proxy 없이는 항상 false).
  // 정확히 1홉(우리 Nginx)만 신뢰한다 — 그 이상은 X-Forwarded-For 스푸핑 위험이 생긴다.
  if (isProd) {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config.get('FRONTEND_ORIGIN', { infer: true }),
    credentials: true,
  });
  // 세션 처리보다 먼저: 위조된 교차 출처 요청이 세션 저장소에 닿기 전에 차단
  app.use(originCheck(config.get('FRONTEND_ORIGIN', { infer: true }), isProd));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 세션: 서버 저장(Postgres) + HttpOnly 쿠키. 테이블은 Prisma 마이그레이션이 관리.
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      name: 'sid',
      secret: config.get('SESSION_SECRET', { infer: true }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: new PgStore({
        pool: new Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
        }),
        tableName: 'session',
        createTableIfMissing: false,
      }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: config.get('SESSION_MAX_AGE_MS', { infer: true }),
      },
    }),
  );

  if (!isProd) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Employee Management API').build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
