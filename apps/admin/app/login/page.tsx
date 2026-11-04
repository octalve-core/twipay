"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../_lib/api";

export default function OpsLogin() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch(`${API_BASE}/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(f.get("email")),
          password: String(f.get("password"))
        })
      });
      if (!r.ok) {
        setMsg("Unable to authenticate. Verify operator credentials.");
        return;
      }
      const me = await fetch(`${API_BASE}/v1/auth/me`, { credentials: "include" }).then((x) => x.json());
      if (!Array.isArray(me.permissions) || !me.permissions.some((p: string) => p.startsWith("ops."))) {
        setMsg("This account lacks operational clearance or permissions.");
        return;
      }
      router.replace(
        me.roles?.includes("SUPER_ADMIN")
          ? "/owner"
          : me.permissions.includes("ops.dashboard.read")
          ? "/"
          : "/support"
      );
    } catch {
      setMsg("Secure sign-in is temporarily unavailable. Check API connectivity.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="ops-login">
      <div className="login-card">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <div className="app-brand-logo">T</div>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>TwiPay Operations</span>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Restricted Administrative Console</div>
          </div>
        </div>

        <h1>Authorized staff sign-in</h1>
        <p>
          Administrative access is strictly permission-scoped and audited. Dual-control operations require an active MFA session.
        </p>

        {msg && (
          <div className="ops-banner danger" style={{ marginTop: "14px", padding: "10px 14px", fontSize: "12px" }}>
            <span>🛑</span>
            <div>{msg}</div>
          </div>
        )}

        <form onSubmit={submit}>
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              placeholder="operator@twipay.com"
              className="pill-input"
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••••••"
              className="pill-input"
            />
          </label>

          <button type="submit" disabled={loading} style={{ marginTop: "6px" }}>
            {loading ? "Authenticating..." : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-light)", fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
          <span>🔒 Authorized staff only. Sign-ins and actions are audited.</span>
        </div>
      </div>
    </main>
  );
}
