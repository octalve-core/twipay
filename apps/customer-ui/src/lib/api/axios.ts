import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const base = import.meta.env.VITE_TWIPAY_API_URL?.replace(/\/$/, "");
const api = axios.create({ baseURL: base ? `${base}/v1` : undefined, withCredentials: true, timeout: 15000 });
const publicAuth = new Set(["/auth/register", "/auth/login", "/auth/logout", "/auth/me", "/kyc/verifications", "/auth/csrf", "/auth/mfa/status", "/auth/mfa/challenge", "/auth/mfa/enroll", "/auth/mfa/enroll/confirm", "/auth/mfa/recovery-codes/regenerate", "/auth/mfa/disable"]);

export function isAllowedIntegratedRoute(url: string | undefined): boolean {
  const path = url?.split("?")[0] ?? "";
  return publicAuth.has(path) || /^\/kyc\/verifications\/[0-9a-fA-F-]{36}\/continue$/.test(path);
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!base) throw new AxiosError("TwiPay API URL is not configured", "API_NOT_CONFIGURED", config);
  if (!isAllowedIntegratedRoute(config.url)) {
    throw new AxiosError("This ErhaPay feature has not yet been integrated with TwiPay", "FEATURE_NOT_INTEGRATED", config);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes((config.method ?? "GET").toUpperCase())
      && !["/auth/register", "/auth/login"].includes(config.url ?? "")) {
    // Session-bound CSRF is rotated by the TwiPay API; do not manufacture an auth token.
    const res = await fetch(`${base}/v1/auth/csrf`, {credentials: "include", cache: "no-store"});
    if (!res.ok) throw new AxiosError("Cannot obtain CSRF authorization", "CSRF_UNAVAILABLE", config);
    const body = await res.json() as {csrfToken?: string};
    if (!body.csrfToken) throw new AxiosError("Cannot obtain CSRF authorization", "CSRF_UNAVAILABLE", config);
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
