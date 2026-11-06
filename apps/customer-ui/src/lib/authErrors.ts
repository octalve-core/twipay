import type { AxiosError } from 'axios'
import { brand } from "@/config/brand";

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  ACCOUNT_ALREADY_EXISTS: 'An account with this email already exists. Try logging in instead.',
  PASSWORD_TOO_SHORT: 'Password must be at least 12 characters long.',
  PASSWORD_TOO_LONG: 'Password must be 128 characters or fewer.',
  ACCOUNT_UNAVAILABLE: 'This account is unavailable. Please contact support.',
}

/** Turns an auth API failure into text a person can act on. The API replies with `{ code }`, not `{ message }`. */
export function authErrorMessage(error: AxiosError, fallback = 'Something went wrong, please try again'): string {
  const response = error.response
  if (!response) return `We can't reach ${brand.name} right now. Check your connection and try again.`
  const data = (response.data ?? {}) as { code?: unknown; message?: unknown; retryAfterSeconds?: unknown }
  if (response.status === 429 || data.code === 'RATE_LIMITED') {
    const seconds = typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 0
    return seconds > 0 ? `Too many attempts. Please wait ${seconds} seconds and try again.` : 'Too many attempts. Please wait a moment and try again.'
  }
  if (typeof data.code === 'string' && MESSAGES[data.code]) return MESSAGES[data.code] as string
  if (response.status < 500 && typeof data.message === 'string' && data.message) return data.message
  return fallback
}
