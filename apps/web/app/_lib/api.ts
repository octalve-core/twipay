export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message?: string) { super(message ?? code); }
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!API_BASE) throw new ApiError(500, 'API_NOT_CONFIGURED');
  const response = await fetch(`${API_BASE}/v1${path}`, { credentials: 'include', cache: 'no-store' });
  const body = await readJson(response);
  if (!response.ok) throw new ApiError(response.status, body?.code ?? 'REQUEST_FAILED');
  return body as T;
}

async function csrfToken(): Promise<string> {
  const value = await apiGet<{ csrfToken: string }>('/auth/csrf');
  if (!value.csrfToken) throw new ApiError(403, 'CSRF_TOKEN_UNAVAILABLE');
  return value.csrfToken;
}

export async function apiMutation<T>(path: string, method: 'POST'|'PATCH'|'DELETE', body?: unknown, options?: { idempotent?: boolean }): Promise<T> {
  if (!API_BASE) throw new ApiError(500, 'API_NOT_CONFIGURED');
  const csrf = await csrfToken();
  const headers: Record<string,string> = { 'x-csrf-token': csrf };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (options?.idempotent) headers['idempotency-key'] = crypto.randomUUID();
  const response = await fetch(`${API_BASE}/v1${path}`, {
    method, credentials: 'include', headers, cache: 'no-store', ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await readJson(response);
  if (!response.ok) throw new ApiError(response.status, payload?.code ?? 'REQUEST_FAILED');
  return payload as T;
}

export function parseNgnMajorToMinor(value: string): string {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new ApiError(400, 'INVALID_NGN_AMOUNT', 'Use a valid NGN amount with at most two decimal places.');
  }
  const [major, fraction = ''] = normalized.split('.');
  const minor = BigInt(major) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (minor <= 0n) throw new ApiError(400, 'INVALID_NGN_AMOUNT', 'Amount must be greater than zero.');
  return minor.toString();
}

export function formatMinor(value: string | bigint | number, currency='NGN'): string {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const major = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
  const parts = formatter.formatToParts(negative ? -major : major);
  let lastNumeric = -1;
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]?.type === 'integer' || parts[index]?.type === 'group') lastNumeric = index;
  }
  if (lastNumeric < 0) return formatter.format(negative ? -major : major);
  parts.splice(lastNumeric + 1, 0, { type: 'decimal', value: '.' }, { type: 'fraction', value: fraction });
  return parts.map((part) => part.value).join('');
}
