import { Buffer } from 'node:buffer';
import { z } from 'zod';

const optionalSecret = z.string().min(1).optional();
const aes256Key = z.string().refine((value) => {
  try {
    return Buffer.from(value, 'base64').length === 32;
  } catch {
    return false;
  }
}, 'must be a base64 value that decodes to exactly 32 bytes');
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url(),
  ADMIN_URL: z.url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  OPENAPI_DOCS_ENABLED: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_HASH_PEPPER: z.string().min(32),
  DATA_ENCRYPTION_KEY: aes256Key,
  PII_FINGERPRINT_KEY: z.string().min(32),
  PAYSTACK_SECRET_KEY: optionalSecret,
  PAYSTACK_BASE_URL: z.url().optional(),
  MONNIFY_API_KEY: optionalSecret,
  MONNIFY_SECRET_KEY: optionalSecret,
  MONNIFY_CONTRACT_CODE: optionalSecret,
  MONNIFY_SOURCE_ACCOUNT_NUMBER: optionalSecret,
  MONNIFY_BASE_URL: z.url().optional(),
  MONNIFY_ALLOW_UNSIGNED_SANDBOX_WEBHOOKS: z.enum(['true', 'false']).default('false'),
  MONO_SECRET_KEY: optionalSecret,
  MONO_BASE_URL: z.url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).passthrough();

export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid TwiPay server environment: ${fields}`);
  }
}
