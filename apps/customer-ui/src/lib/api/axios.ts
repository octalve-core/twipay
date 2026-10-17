import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const base = import.meta.env.VITE_TWIPAY_API_URL?.replace(/\/$/, "");
const api = axios.create({
  baseURL: base ? `${base}/v1` : undefined,
  withCredentials: true,
  timeout: 15000,
});
const publicAuth = new Set([
  "/payments/collections",
  "/transfers",
  "/transfers/resolve-account",
  "/transfers/banks",
  "/transfers/beneficiaries",
  "/transfers/quote",
  "/auth/register",
  "/auth/login",
  "/auth/google/start",
  "/auth/google/status",
  "/auth/google/link/start",
  "/auth/google/link/status",
  "/auth/password/reset/request",
  "/auth/password/reset/complete",
  "/auth/password/change",
  "/auth/password/enrollment/status",
  "/auth/password/enrollment/request",
  "/auth/password/enrollment/complete",
  "/auth/transaction-pin/status",
  "/auth/transaction-pin/set",
  "/auth/transaction-pin/change",
  "/auth/transaction-pin/reset/request",
  "/auth/transaction-pin/reset/complete",
  "/auth/sessions",
  "/auth/sessions/revoke-others",
  "/auth/logout",
  "/auth/me",
  "/kyc/verifications",
  "/wallets",
  "/virtual-accounts",
  "/virtual-accounts/validation-banks",
  "/auth/csrf",
  "/auth/contact/email/resend",
  "/auth/contact/email/confirm",
  "/auth/mfa/status",
  "/auth/mfa/challenge",
  "/auth/mfa/enroll",
  "/auth/mfa/enroll/confirm",
  "/auth/mfa/recovery-codes/regenerate",
  "/auth/mfa/disable",
  "/services/products",
  "/services/validations",
  "/services/quotes",
  "/services/purchases",
  "/events",
  "/events/orders",
  "/events/organizers/me",
  "/events/organizers",
  "/events/quote",
  "/events/checkout",
  "/disputes",
  "/notifications",
  "/notifications/inbox",
  "/notifications/inbox/read-all",
  "/notifications/preferences",
  "/support/cases",
]);

export function isAllowedIntegratedRoute(url: string | undefined): boolean {
  const path = url?.split("?")[0] ?? "";
  return (
    publicAuth.has(path) ||
    path === "/operations/staff/invitations/mine" ||
    /^\/operations\/staff\/invitations\/[0-9a-fA-F-]{36}\/accept$/.test(path) ||
    /^\/transfers\/beneficiaries\/[0-9a-fA-F-]{36}(?:\/(?:quote|transfer))?$/.test(path) ||
    /^\/events\/(?:orders\/)?[A-Za-z0-9._:-]{1,100}$/.test(path) ||
    /^\/events\/orders\/[A-Za-z0-9._:-]{1,100}\/refund-requests$/.test(path) ||
    /^\/events\/checkout-intents\/twipay-event:[0-9a-f-]{36}$/.test(path) ||
    /^\/events\/organizers\/[0-9a-fA-F-]{36}\/(?:events|payouts)$/.test(path) ||
    /^\/events\/[0-9a-fA-F-]{36}\/(?:ticket-types|publish)$/.test(path) ||
    /^\/events\/orders\/[A-Za-z0-9._:-]{1,100}\/tickets\/TWP-[A-Za-z0-9_-]{8,100}\/credential$/.test(
      path,
    ) ||
    path === "/events/tickets/check-in/assignments" ||
    path === "/events/tickets/check-in" ||
    /^\/events\/[0-9a-fA-F-]{36}\/staff(?:\/[0-9a-fA-F-]{36})?$/.test(path) ||
    /^\/support\/cases\/sup_[0-9a-f-]{36}(?:\/replies)?$/.test(path) ||
    /^\/notifications\/inbox\/[0-9a-fA-F-]{36}\/read$/.test(path) ||
    path === "/transactions" ||
    /^\/transactions\/[A-Za-z0-9._:-]{1,80}$/.test(path) ||
    /^\/kyc\/verifications\/[0-9a-fA-F-]{36}\/continue$/.test(path) ||
    /^\/services\/purchases\/[A-Za-z0-9._:-]{1,80}$/.test(path)
  );
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!base)
    throw new AxiosError(
      "We can’t connect right now. Please try again later.",
      "API_NOT_CONFIGURED",
      config,
    );
  if (!isAllowedIntegratedRoute(config.url)) {
    throw new AxiosError(
      "This feature isn’t available right now.",
      "FEATURE_NOT_INTEGRATED",
      config,
    );
  }
  if (
    !["GET", "HEAD", "OPTIONS"].includes((config.method ?? "GET").toUpperCase()) &&
    // prettier-ignore
    !["/auth/register", "/auth/login", "/auth/google/start", "/auth/password/reset/request", "/auth/password/reset/complete"].includes(config.url ?? "")
  ) {
    // Each active session has one stable, server-verified CSRF token.
    // Concurrent mutations must not invalidate one another. Never mint tokens client-side.
    const res = await fetch(`${base}/v1/auth/csrf`, { credentials: "include", cache: "no-store" });
    if (!res.ok)
      throw new AxiosError(
        "We couldn’t complete this request. Please sign in again and retry.",
        "CSRF_UNAVAILABLE",
        config,
      );
    const body = (await res.json()) as { csrfToken?: string };
    if (!body.csrfToken)
      throw new AxiosError(
        "We couldn’t complete this request. Please sign in again and retry.",
        "CSRF_UNAVAILABLE",
        config,
      );
    config.headers.set("x-csrf-token", body.csrfToken);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      ![
        "/auth/login",
        "/auth/register",
        "/auth/me",
        "/auth/password/reset/request",
        "/auth/password/reset/complete",
      ].includes(error.config?.url ?? "")
    ) {
      window.dispatchEvent(new Event("twipay:session-invalidated"));
    }
    return Promise.reject(error);
  },
);

export default api;
