import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Worker, type ConnectionOptions } from 'bullmq';
import pino from 'pino';
import { AppModule, BillService, NotificationService, validateEnvironment } from '@twipay/api/worker-entry';

validateEnvironment(process.env);

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: ['*.token', '*.secret', '*.password', '*.bvn', '*.nin', '*.accountNumber', '*.qrPayload', '*.destination'],
});

function redisConnection(urlValue: string): ConnectionOptions {
  const url = new URL(urlValue);
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') throw new Error('REDIS_URL_PROTOCOL_INVALID');
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.pathname && url.pathname !== '/' ? { db: Number(url.pathname.slice(1)) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

const redisUrl = process.env['REDIS_URL'];
if (!redisUrl) throw new Error('REDIS_URL_REQUIRED');
const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const bills = app.get(BillService);
const notifications = app.get(NotificationService);
const connection = redisConnection(redisUrl);

const worker = new Worker('twipay-domain', async (job) => {
  if (job.name === 'bill-reconcile') {
    const data = job.data as { reference?: unknown };
    if (typeof data.reference !== 'string' || data.reference.length < 8) throw new Error('BILL_RECONCILE_REFERENCE_INVALID');
    await bills.reconcile(data.reference);
    return;
  }
  if (job.name === 'notification-deliver') {
    const data = job.data as { notificationId?: unknown };
    if (typeof data.notificationId !== 'string') throw new Error('NOTIFICATION_ID_INVALID');
    await notifications.deliver(data.notificationId);
    return;
  }
  throw new Error(`UNSUPPORTED_TWIPAY_JOB:${job.name}`);
}, { connection, concurrency: 10 });

worker.on('failed', (job, error) => logger.error({ jobId: job?.id, jobName: job?.name, errorName: error.name }, 'TwiPay domain job failed'));
worker.on('error', (error) => logger.error({ errorName: error.name }, 'TwiPay worker error'));

let sweepRunning = false;
async function recoverySweep(): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const [billCount, notificationCount] = await Promise.all([bills.reconcileDue(25), notifications.processPending(25)]);
    if (billCount || notificationCount) logger.info({ billCount, notificationCount }, 'TwiPay recovery sweep processed pending work');
  } catch (error) {
    logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'TwiPay recovery sweep failed');
  } finally {
    sweepRunning = false;
  }
}

const sweepMs = Number(process.env['WORKER_RECOVERY_SWEEP_MS'] ?? '60000');
if (!Number.isInteger(sweepMs) || sweepMs < 10_000 || sweepMs > 3_600_000) throw new Error('WORKER_RECOVERY_SWEEP_MS_INVALID');
await recoverySweep();
const timer = setInterval(() => { void recoverySweep(); }, sweepMs);
timer.unref();
logger.info({ service: 'twipay-worker', sweepMs }, 'TwiPay worker started');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'TwiPay worker shutting down');
  clearInterval(timer);
  await worker.close();
  await app.close();
  process.exit(0);
}
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
