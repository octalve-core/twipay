import { SENSITIVE_LOG_PATHS } from '@twipay/security';

export function buildLoggerOptions() {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [...SENSITIVE_LOG_PATHS],
      censor: '[REDACTED]',
    },
    serializers: {
      req(request: { method?: string; url?: string; id?: string }) {
        return { method: request.method, url: request.url, requestId: request.id };
      },
    },
  } as const;
}
