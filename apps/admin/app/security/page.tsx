"use client";

import { FormEvent, useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { opsGet, opsMutation } from "../_lib/api";

type Status = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  enrollmentPending: boolean;
};

export default function SecurityPage() {
  const [status, setStatus] = useState<Status>();
  const [enrollment, setEnrollment] = useState<any>();
  const [codes, setCodes] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      setStatus((await opsGet<{ mfa: Status }>("/auth/mfa/status")).mfa);
    } catch (x: any) {
      setMsg(x.code || "Unable to load MFA");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function begin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const r = await opsMutation<any>("/auth/mfa/enroll", {
        password: String(f.get("password") || "")
      });
      setEnrollment(r.enrollment);
      setMsg("Enrollment started. Add the secret key to your authenticator app and confirm a fresh 6-digit code.");
      await load();
    } catch (x: any) {
      setMsg(x.code || "Unable to enroll");
    }
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const r = await opsMutation<any>("/auth/mfa/enroll/confirm", {
        code: String(f.get("code") || "")
      });
      setCodes(r.recoveryCodes ?? []);
      setEnrollment(undefined);
      setMsg("MFA enabled and the admin session was rotated. Save the recovery codes now.");
      await load();
    } catch (x: any) {
      setMsg(x.code || "Unable to confirm");
    }
  }

  async function challenge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const r = await opsMutation<any>("/auth/mfa/challenge", {
        code: String(f.get("code") || "")
      });
      setMsg(`Recent MFA satisfied using ${r.method}.`);
    } catch (x: any) {
      setMsg(x.code || "Unable to step up");
    }
  }

  async function regenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const r = await opsMutation<any>("/auth/mfa/recovery-codes/regenerate", {
        code: String(f.get("code") || "")
      });
      setCodes(r.recoveryCodes ?? []);
      setMsg("Recovery codes replaced; previous unused codes are invalid.");
      await load();
    } catch (x: any) {
      setMsg(x.code || "Unable to regenerate");
    }
  }

  async function disable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await opsMutation("/auth/mfa/disable", {
        code: String(f.get("code") || ""),
        reason: "STAFF_DISABLED_FROM_OPERATIONS"
      });
      setCodes([]);
      setEnrollment(undefined);
      setMsg("MFA disabled; other sessions were revoked. High-risk operations remain unavailable until re-enrollment and step-up.");
      await load();
    } catch (x: any) {
      setMsg(x.code || "Unable to disable");
    }
  }

  return (
    <OpsShell
      title="Security &amp; Hardware MFA Enrolment"
      eyebrow="Zero-Trust Authentication Credentials"
    >
      <div className="ops-banner info">
        <span>🔒</span>
        <div>
          <strong>Session Assurance Invariant:</strong> High-risk operations require a configured hardware token or TOTP factor with step-up verification completed within the last 15 minutes.
        </div>
      </div>

      {msg && (
        <div className="ops-banner" style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}>
          <span>ℹ️</span>
          <div>{msg}</div>
        </div>
      )}

      {/* Two Column Security Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr", gap: "24px" }}>
        {/* Factor Status & Step-Up Card */}
        <div className="ops-panel">
          <h2>Authenticator Factor Status</h2>
          {!status ? (
            <p style={{ color: "var(--text-muted)" }}>Loading MFA factor standing…</p>
          ) : status.enabled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "var(--green-bg)",
                  borderRadius: "12px",
                  border: "1px solid var(--green-border)"
                }}
              >
                <div>
                  <strong style={{ color: "var(--green-text)" }}>Enabled. Two-Factor Authentication Active</strong>
                  <span style={{ display: "block", fontSize: "11px", color: "var(--green-text)", opacity: 0.85 }}>
                    Enrolled {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString() : "recently"}
                  </span>
                </div>
                <span className="pill-badge" style={{ background: "#FFFFFF", color: "var(--green-text)" }}>
                  {status.recoveryCodesRemaining} Backup Codes Remaining
                </span>
              </div>

              {/* Step-Up Challenge Form */}
              <form onSubmit={challenge} className="ops-form" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
                <h3 style={{ fontSize: "14px" }}>Step Up Current Session</h3>
                <label>
                  Authenticator/recovery code
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    required
                    maxLength={32}
                    className="pill-input"
                    placeholder="Enter code from Google Authenticator or 1Password"
                  />
                </label>
                <button type="submit" className="btn-pill primary" style={{ height: "38px" }}>
                  Step up this session
                </button>
              </form>

              {/* Replace Recovery Codes Form */}
              <form onSubmit={regenerate} className="ops-form" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
                <h3 style={{ fontSize: "14px" }}>Regenerate Backup Recovery Codes</h3>
                <label>
                  Current 6-Digit Code
                  <input name="code" required maxLength={32} className="pill-input" placeholder="Current code to authorize set replacement" />
                </label>
                <button type="submit" className="btn-pill" style={{ height: "38px" }}>
                  Replace Recovery Codes
                </button>
              </form>

              {/* Disable MFA Form */}
              <form onSubmit={disable} className="ops-form" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
                <h3 style={{ fontSize: "14px", color: "var(--coral-text)" }}>Emergency MFA De-enrollment</h3>
                <label>
                  Current Code or Recovery Key
                  <input name="code" required maxLength={32} className="pill-input" placeholder="Enter code to revoke MFA factor" />
                </label>
                <button type="submit" className="btn-pill danger" style={{ height: "38px" }}>
                  Disable MFA &amp; Revoke Sessions
                </button>
              </form>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
                <span>⚠️</span>
                <div>
                  MFA factor is not yet enrolled. High-risk operations (payout approvals, refunds, and invitations) will remain blocked until setup is complete.
                </div>
              </div>

              <form onSubmit={begin} className="ops-form">
                <label>
                  Verify Account Password to Begin Setup
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="pill-input"
                    placeholder="Current operator password"
                  />
                </label>
                <button type="submit" className="btn-pill primary" style={{ height: "40px" }}>
                  Start Factor Enrollment &rarr;
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Enrollment Instructions & Session Security Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {enrollment && (
            <div className="ops-panel" style={{ border: "2px solid var(--brand-blue)" }}>
              <h2>Configure Authenticator App</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
                <div style={{ padding: "12px", background: "var(--surface-subtle)", borderRadius: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Manual Setup Secret Key
                  </span>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: "16px", color: "var(--brand-blue)", marginTop: "4px" }}>
                    {enrollment.manualSecret}
                  </div>
                </div>

                <details style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
                  <summary style={{ fontWeight: 600 }}>Inspect otpauth:// URI</summary>
                  <code style={{ wordBreak: "break-all", display: "block", marginTop: "6px", background: "#FFFFFF", padding: "8px", borderRadius: "6px" }}>
                    {enrollment.otpauthUri}
                  </code>
                </details>

                <form onSubmit={confirm} className="ops-form" style={{ marginTop: "8px" }}>
                  <label>
                    Enter 6-Digit Code from App to Confirm
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="\d{6}"
                      required
                      maxLength={6}
                      className="pill-input"
                      placeholder="123456"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16px", letterSpacing: "4px" }}
                    />
                  </label>
                  <button type="submit" className="btn-pill primary" style={{ height: "40px" }}>
                    Confirm &amp; Activate MFA Factor &rarr;
                  </button>
                </form>
              </div>
            </div>
          )}

          {codes.length > 0 && (
            <div className="ops-panel" style={{ border: "2px solid #059669" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Recovery Backup Codes</h2>
                <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
                  Save Now (Shown Once)
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 12px" }}>
                Store these codes securely in an offline vault. Each code can be used once to access the portal if your device is lost.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  background: "var(--surface-subtle)",
                  padding: "14px",
                  borderRadius: "12px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700
                }}
              >
                {codes.map((c, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "#FFFFFF", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Security Invariant Card */}
          <div className="ops-panel">
            <h2>Session Security &amp; Token Rotation</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Recent MFA creates a fresh opaque HttpOnly session token. The pre-MFA session is revoked and cannot inherit assurance. Absolute session lifetime is bounded to 8 hours and is never extended by rotation.
            </p>
          </div>
        </div>
      </div>
    </OpsShell>
  );
}
