import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Queue, QueueEvents, Worker, type ConnectionOptions } from 'bullmq';

function connectionFromUrl(value: string): ConnectionOptions {
  const url = new URL(value);
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('REDIS_URL_PROTOCOL_INVALID');
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.pathname !== '/' ? { db: Number(url.pathname.slice(1)) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

const redisUrl = process.env['REDIS_URL'];
const run = redisUrl ? describe : describe.skip;

run('Redis/BullMQ qualification', () => {
  const queueName = `twipay-worker-qualification-${process.pid}`;
  const connection = connectionFromUrl(redisUrl!);
  let queue: Queue;
  let events: QueueEvents;

  beforeAll(async () => {
    queue = new Queue(queueName, { connection });
    events = new QueueEvents(queueName, { connection });
    await events.waitUntilReady();
  });
  afterAll(async () => { await queue.obliterate({ force: true }); await events.close(); await queue.close(); });

  it('creates, delivers, retries and deduplicates named work by job id', async () => {
    let attempts = 0;
    const seen: string[] = [];
    const worker = new Worker(queueName, async (job) => {
      attempts += 1;
      if (job.name === 'retry-once' && attempts === 1) throw new Error('QUALIFICATION_TRANSIENT');
      seen.push(`${job.name}:${job.id}`);
      return { ok: true };
    }, { connection, concurrency: 2 });

    try {
      const first = await queue.add('idempotent', { reference: 'ref-1' }, { jobId: 'stable-ref-1', removeOnComplete: false });
      const duplicate = await queue.add('idempotent', { reference: 'ref-1' }, { jobId: 'stable-ref-1', removeOnComplete: false });
      expect(duplicate.id).toBe(first.id);
      await first.waitUntilFinished(events, 10_000);

      attempts = 0;
      const retried = await queue.add('retry-once', { reference: 'ref-2' }, { attempts: 2, backoff: { type: 'fixed', delay: 50 }, removeOnComplete: false });
      await retried.waitUntilFinished(events, 10_000);
      expect(attempts).toBe(2);
      expect(seen.filter((entry) => entry.startsWith('idempotent:'))).toHaveLength(1);
    } finally {
      await worker.close();
    }
  });

  it('recovers pending work after a worker restart', async () => {
    const job = await queue.add('restart', { reference: 'ref-restart' }, { removeOnComplete: false });
    const worker = new Worker(queueName, async (item) => item.data, { connection, concurrency: 1 });
    try {
      await expect(job.waitUntilFinished(events, 10_000)).resolves.toEqual({ reference: 'ref-restart' });
    } finally {
      await worker.close();
    }
  });
});
