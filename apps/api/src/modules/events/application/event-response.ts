import type { JsonObject, JsonValue } from '@twipay/contracts';

/**
 * Legacy event checkout idempotency responses may contain the entrance credential.
 * A replay must never expose it; new responses must not persist it at all.
 * Only the explicitly enumerated non-sensitive ticket metadata crosses this boundary.
 */
export function publicCheckoutResponse(body: JsonObject): JsonObject {
  const result: JsonObject = { ...body };
  if (Array.isArray(body['tickets'])) {
    result['tickets'] = body['tickets'].map((raw: JsonValue) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const ticket = raw as JsonObject;
      const safe: JsonObject = {};
      if (typeof ticket['publicCode'] === 'string') safe['publicCode'] = ticket['publicCode'];
      if (typeof ticket['ticketTypeId'] === 'string') safe['ticketTypeId'] = ticket['ticketTypeId'];
      if (typeof ticket['status'] === 'string') safe['status'] = ticket['status'];
      return safe;
    });
  }
  return result;
}
