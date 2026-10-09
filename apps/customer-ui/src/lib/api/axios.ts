import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const base = import.meta.env.VITE_TWIPAY_API_URL?.replace(/\/$/, "");
const api = axios.create({ baseURL: base ? `${base}/v1` : undefined, withCredentials: true, timeout: 15000 });
const publicAuth = new Set(["/payments/collections", "/transfers", "/transfers/resolve-account", "/transfers/banks", "/auth/register", "/auth/login", "/auth/logout", "/auth/me", "/kyc/verifications", "/wallets", "/virtual-accounts", "/virtual-accounts/validation-banks", "/auth/csrf", "/auth/mfa/status", "/auth/mfa/challenge", "/auth/mfa/enroll", "/auth/mfa/enroll/confirm", "/auth/mfa/recovery-codes/regenerate", "/auth/mfa/disable", "/services/products", "/services/validations", "/services/purchases", "/events", "/events/orders", "/events/quote", "/events/checkout", "/disputes", "/notifications"]);

export function isAllowedIntegratedRoute(url: string | undefined): boolean {
  const path = url?.split("?")[0] ?? "";
  return publicAuth.has(path) || /^\/events\/(?:orders\/)?[A-Za-z0-9._:-]{1,100}$/.test(path) || /^\/events\/checkout-intents\/twipay-event:[0-9a-f-]{36}$/.test(path) || path === "/transactions" || /^\/transactions\/[A-Za-z0-9._:-]{1,80}$/.test(path) || /^\/kyc\/verifications\/[0-9a-fA-F-]{36}\/continue$/.test(path) || /^\/services\/purchases\/[A-Za-z0-9._:-]{1,80}$/.test(path);
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!base) throw new AxiosError("We can’t connect right now. Please try again later.", "API_NOT_CONFIGURED", config);
  if (!isAllowedIntegratedRoute(config.url)) {
    throw new AxiosError("This feature isn’t available right now.", "FEATURE_NOT_INTEGRATED", config);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes((config.method ?? "GET").toUpperCase())
      && !["/auth/register", "/auth/login"].includes(config.url ?? "")) {
    // Each active session has one stable, server-verified CSRF token.
    // Concurrent mutations must not invalidate one another. Never mint tokens client-side.
    const res = await fetch(`${base}/v1/auth/csrf`, {credentials: "include", cache: "no-store"});
    if (!res.ok) throw new AxiosError("We couldn’t complete this request. Please sign in again and retry.", "CSRF_UNAVAILABLE", config);
    const body = await res.json() as {csrfToken?: string};
    if (!body.csrfToken) throw new AxiosError("We couldn’t complete this request. Please sign in again and retry.", "CSRF_UNAVAILABLE", config);
    config.headers.set("x-csrf-token", body.csrfToken);
  }
  return config;
});

api.interceptors.response.use((response) => response, (error: AxiosError) => {
  if (error.response?.status === 401 && !["/auth/login", "/auth/register", "/auth/me"].includes(error.config?.url ?? "")) {
    window.dispatchEvent(new Event("twipay:session-invalidated"));
  }
  return Promise.reject(error);
});

export default api;
