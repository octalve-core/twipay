import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url(),
  ADMIN_URL: z.url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_HASH_PEPPER: z.string().min(32),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).passthrough();

export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid TwiPay server environment: ${fields}`);
  }
}
