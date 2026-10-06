import 'reflect-metadata';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app.module.js';
import { buildLoggerOptions } from './platform/logging/logger.js';
import { validateEnvironment } from './platform/config/env.js';

async function bootstrap(): Promise<void> {
  validateEnvironment(process.env);
  const adapter = new FastifyAdapter({
    logger: buildLoggerOptions(),
    trustProxy: process.env.TRUST_PROXY === 'true',
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { bufferLogs: true });
  const production = process.env.NODE_ENV === 'production';
  const allowedOrigins = [process.env.APP_URL, process.env.ADMIN_URL].filter((v): v is string => Boolean(v));

  await app.register(cookie, { hook: 'onRequest' });
  await app.register(cors, {
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Origin is not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id', 'idempotency-key'],
  });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    ban: 2,
    skipOnError: false,
  });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    hsts: production ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
  });

  app.setGlobalPrefix('v1');

  const openApi = new DocumentBuilder()
    .setTitle('TwiPay API')
    .setDescription('Provider-neutral TwiPay API. Browser authentication uses secure opaque sessions.')
    .setVersion('1.0')
    .addCookieAuth(production ? '__Host-twipay_session' : 'twipay_session')
    .build();
  const document = SwaggerModule.createDocument(app, openApi);
  SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: false } });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
