import 'reflect-metadata';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { HttpException, HttpStatus } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app.module.js';
import { buildLoggerOptions } from './platform/logging/logger.js';
import { validateEnvironment } from './platform/config/env.js';
import { riskRatePolicy } from './platform/http/risk-rate-limit.js';

async function bootstrap(): Promise<void> {
  validateEnvironment(process.env);
  const adapter = new FastifyAdapter({
    logger: buildLoggerOptions(),
    trustProxy: process.env['TRUST_PROXY'] === 'true',
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { bufferLogs: true, rawBody: true });
  const production = process.env['NODE_ENV'] === 'production';
  const allowedOrigins = [process.env['APP_URL'], process.env['ADMIN_URL']].filter((v): v is string => Boolean(v));

  await app.register(cookie, { hook: 'onRequest' });
  await app.register(cors, {
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      // Absence of a CORS allowance is not a server fault. Unsafe browser
      // requests still reach the request-security guard, which rejects their
      // untrusted Origin with 403 (not a misleading 500 from this callback).
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id', 'idempotency-key'],
  });
  await app.register(rateLimit, {
    global: true,
    max: async (request) => riskRatePolicy(request).max,
    timeWindow: async (request) => riskRatePolicy(request).timeWindowMs,
    keyGenerator: (request) => `${riskRatePolicy(request).bucket}:${request.ip}`,
    ban: 2,
    skipOnError: false,
    // The plugin throws a plain Error carrying statusCode; Nest only maps HttpException, so without this the
    // client receives "500 Internal server error" instead of 429 (and a banned client would get 403 as a 500).
    errorResponseBuilder: (_request, context) => new HttpException(
      { code: 'RATE_LIMITED', retryAfterSeconds: Math.max(1, Math.ceil(context.ttl / 1000)) },
      HttpStatus.TOO_MANY_REQUESTS,
    ),
  });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: production ? {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    } : false,
    hsts: production ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
  });

  // Financial, identity and session responses can contain user-specific state.
  // Prevent intermediary/browser caches from retaining API responses by default.
  app.getHttpAdapter().getInstance().addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    return payload;
  });

  app.setGlobalPrefix('v1');

  const openApi = new DocumentBuilder()
    .setTitle('TwiPay API')
    .setDescription('Provider-neutral TwiPay API. Browser authentication uses secure opaque sessions.')
    .setVersion('1.0')
    .addCookieAuth(production ? '__Host-twipay_session' : 'twipay_session')
    .build();
  const document = SwaggerModule.createDocument(app, openApi);
  const docsEnabled = !production || process.env['OPENAPI_DOCS_ENABLED'] === 'true';
  if (docsEnabled) {
    SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: false } });
  }

  const port = Number(process.env['API_PORT'] ?? 4000);
  // Explicitly bind qualification servers to loopback; production retains
  // container-compatible binding unless deployment supplies an alternate host.
  await app.listen(port, process.env['API_BIND_HOST'] ?? '0.0.0.0');
}

void bootstrap();
