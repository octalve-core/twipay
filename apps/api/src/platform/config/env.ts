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
  MFA_STEP_UP_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
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
  VTPASS_API_KEY: optionalSecret,
  VTPASS_PUBLIC_KEY: optionalSecret,
  VTPASS_SECRET_KEY: optionalSecret,
  VTPASS_BASE_URL: z.url().optional(),
  TERMII_API_KEY: optionalSecret,
  TERMII_SENDER_ID: z.string().min(1).max(32).optional(),
  TERMII_CHANNEL: z.string().min(1).max(32).optional(),
  TERMII_BASE_URL: z.url().optional(),
  RESEND_API_KEY: optionalSecret,
  RESEND_FROM: z.string().min(3).max(320).optional(),
  RESEND_BASE_URL: z.url().optional(),
  TICKET_SIGNING_KEYS_JSON: optionalSecret,
  TICKET_SIGNING_CURRENT_VERSION: z.coerce.number().int().min(1).max(1000).default(1),
  BILL_VALIDATION_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  BILL_RECONCILE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(12),
  BILL_RECONCILE_BASE_DELAY_MS: z.coerce.number().int().min(5000).max(300000).default(30000),
  BILL_RECONCILE_MAX_DELAY_MS: z.coerce.number().int().min(5000).max(3600000).default(900000),
  EVENT_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(5000).default(0),
  EVENT_ORDER_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  WORKER_RECOVERY_SWEEP_MS: z.coerce.number().int().min(10000).max(3600000).default(60000),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  NOTIFICATION_RETRY_DELAY_MS: z.coerce.number().int().min(10000).max(3600000).default(60000),
  NOTIFICATION_PROCESSING_STALE_MS: z.coerce.number().int().min(60000).max(86400000).default(300000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).passthrough();

export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid TwiPay server environment: ${fields}`);
  }
}
