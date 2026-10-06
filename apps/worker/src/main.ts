import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', redact: ['*.token', '*.secret', '*.password', '*.bvn', '*.nin'] });
logger.info({ service: 'twipay-worker' }, 'worker bootstrap ready; queues are activated by later domain batches');
