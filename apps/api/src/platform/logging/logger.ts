import { SENSITIVE_LOG_PATHS } from '@twipay/security';

export function buildLoggerOptions() {
  return {
    level: process.env['LOG_LEVEL'] ?? 'info',
    redact: {
      paths: [...SENSITIVE_LOG_PATHS],
      censor: '[REDACTED]',
    },
    serializers: {
      req(request: { method?: string; url?: string; id?: string }) {
        // Query strings may contain credentials or identity values despite URL policy.
        // Never serialize them into persistent access logs.
        return { method: request.method, path: request.url?.split(/[?#]/, 1)[0], requestId: request.id };
      },
    },
  };
}
