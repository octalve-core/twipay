"use client";

import { FormEvent, useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { opsGet, opsMutation, explainCode } from "../_lib/api";
import { ApproveModal, RejectModal } from "../_components/modals";

export default function Config() {
  const [d, setD] = useState<any>();
  const [reviews, setReviews] = useState<any[]>([]);
  const [e, setE] = useState("");
  const [msg, setMsg] = useState("");

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  async function load() {
    try {
      const [flags, publicCfg, deployment] = await Promise.all([
        opsGet<any>("/product/admin/flags"),
        opsGet<any>("/product/config"),
        opsGet<any>("/product/admin/deployment")
      ]);
      setD({ flags, publicCfg, deployment });
      const q = await opsGet<{ reviews: any[] }>("/operations/owner/config/reviews");
      setReviews(q.reviews);
      setE("");
    } catch (x: any) {
      setE(explainCode(x.code, "REQUEST_FAILED"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(f: any) {
    if (!f.enabled) {
      setMsg("Activation is not available from the owner configuration workflow.");
      return;
    }
    try {
      await opsMutation("/operations/owner/config/reviews", {
        kind: "FLAG_DISABLE",
        data: { key: f.key, enabled: false, public: f.public, description: f.description },
        reason: "Owner-requested disable with independent configuration review"
      });
      setMsg("Disable request staged for independent approval.");
      await load();
    } catch (x: any) {
      setMsg(explainCode(x.code, "ACTION_BLOCKED"));
    }
  }

  async function brand(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    try {
      await opsMutation("/operations/owner/config/reviews", {
        kind: "BRAND",
        data: {
          productName: String(f.get("productName")),
          legalName: String(f.get("legalName")),
          domain: String(f.get("domain")),
          supportEmail: String(f.get("supportEmail")),
          primaryColor: String(f.get("primaryColor")),
          accentColor: String(f.get("accentColor"))
        },
        reason: String(f.get("reason"))
      });
      setMsg("Brand change staged; another owner must approve.");
      await load();
    } catch (x: any) {
      setMsg(explainCode(x.code, "ACTION_BLOCKED"));
    }
  }

  async function deployment(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const allowedModules = String(f.get("allowedModules"))
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      await opsMutation("/operations/owner/config/reviews", {
        kind: "DEPLOYMENT",
        data: {
          productSlug: String(f.get("productSlug")),
          edition: String(f.get("edition")),
          licensedTo: String(f.get("licensedTo")),
          status: String(f.get("status")),
          allowedModules,
          supportMode: String(f.get("supportMode")),
          licenseReference: String(f.get("licenseReference") || "").trim() || null,
          validUntil: String(f.get("validUntil") || "").trim()
            ? new Date(String(f.get("validUntil"))).toISOString()
            : null
        },
        reason: String(f.get("reason"))
      });
      setMsg("Deployment change staged; another owner must approve.");
      await load();
    } catch (x: any) {
      setMsg(explainCode(x.code, "ACTION_BLOCKED"));
    }
  }

  async function handleConfirmApprove() {
    if (!approveTarget) return;
    try {
      await opsMutation(`/operations/owner/config/reviews/${approveTarget.id}/approve`, {});
      setMsg("Independent approval recorded.");
      setApproveTarget(null);
      await load();
    } catch (x: any) {
      setMsg(explainCode(x.code, "ACTION_BLOCKED"));
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!rejectTarget) return;
    try {
      await opsMutation(`/operations/owner/config/reviews/${rejectTarget.id}/reject`, { reason });
      setMsg("Independent rejection recorded.");
      setRejectTarget(null);
      await load();
    } catch (x: any) {
      setMsg(explainCode(x.code, "ACTION_BLOCKED"));
    }
  }

  const profile = d?.deployment?.deployment;

  return (
    <OpsShell
      title="Configuration, Feature Flags &amp; Licensing"
      eyebrow="Immutable Deployment Controls"
    >
      <div className="ops-banner info">
        <span>⚙️</span>
        <div>
          <strong>Staged Configuration Invariant:</strong> All writes are staged, checked by a different owner with recent MFA, and compared against current database state. Production mutations and financial activation remain blocked.
        </div>
      </div>

      {msg && (
        <div className="ops-banner" style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}>
          <span>ℹ️</span>
          <div>{msg}</div>
        </div>
      )}

      {e ? (
        <Fail code={e} />
      ) : !d ? (
        <Wait />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Feature Flags Card */}
          <div className="ops-panel">
            <h2>Operational Feature Flags</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {d.flags.flags.map((f: any) => (
                <div key={f.key} className="flag-row">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong>{f.key}</strong>
                      <span
                        className="pill-badge"
                        style={{
                          background: f.enabled ? "var(--green-bg)" : "var(--coral-bg)",
                          color: f.enabled ? "var(--green-text)" : "var(--coral-text)"
                        }}
                      >
                        {f.enabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </div>
                    <small>{f.description || "No description configured"}</small>
                  </div>
                  <button
                    className={`btn-pill ${f.enabled ? "danger" : ""}`}
                    style={{ height: "30px", fontSize: "11px" }}
                    onClick={() => toggle(f)}
                  >
                    {f.enabled ? "Prepare Disable" : "Activation Blocked"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Owner Reviews Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Pending Independent Owner Reviews</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Two-person control verification required
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
                {reviews.length} Staged
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Target Change</th>
                  <th>Justification / Maker</th>
                  <th style={{ textAlign: "right" }}>Checker Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>No pending configuration reviews.</td></tr>
                ) : (
                  reviews.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <strong>{q.kind}</strong>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--brand-blue)" }}>
                          {q.targetKey}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px" }}>{q.reason}</span>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                          Maker: {q.preparedByUserId}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                          <button
                            className="btn-pill primary"
                            style={{ height: "30px", fontSize: "11px" }}
                            onClick={() => setApproveTarget(q)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-pill danger"
                            style={{ height: "30px", fontSize: "11px" }}
                            onClick={() => setRejectTarget(q)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Product Branding Form */}
          <div className="ops-panel">
            <h2>Product Branding &amp; Presentation</h2>
            <form onSubmit={brand} className="ops-form">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Product Name
                  <input name="productName" defaultValue={d.publicCfg.brand?.productName || ""} required className="pill-input" />
                </label>
                <label>
                  Legal Name
                  <input name="legalName" defaultValue={d.publicCfg.brand?.legalName || ""} required className="pill-input" />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Domain
                  <input name="domain" defaultValue={d.publicCfg.brand?.domain || ""} required className="pill-input" />
                </label>
                <label>
                  Support Email
                  <input name="supportEmail" defaultValue={d.publicCfg.brand?.supportEmail || ""} required className="pill-input" />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Primary Colour
                  <input name="primaryColor" defaultValue={d.publicCfg.brand?.primaryColor || "#0062E6"} required className="pill-input" />
                </label>
                <label>
                  Accent Colour
                  <input name="accentColor" defaultValue={d.publicCfg.brand?.accentColor || "#10B981"} required className="pill-input" />
                </label>
              </div>

              <label>
                Change Reason
                <input name="reason" defaultValue="Authorized brand configuration change" required className="pill-input" />
              </label>

              <button type="submit" className="btn-pill primary" style={{ height: "40px" }}>
                Prepare Brand Change &rarr;
              </button>
            </form>
          </div>

          {/* Deployment Profile Form */}
          <div className="ops-panel">
            <h2>Deployment Profile &amp; Modules</h2>
            <form onSubmit={deployment} className="ops-form">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Product Slug
                  <input name="productSlug" defaultValue={profile?.productSlug || "twipay"} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required className="pill-input" />
                </label>
                <label>
                  Edition
                  <select name="edition" defaultValue={profile?.edition || "TWIPAY_OWNED"} className="pill-input">
                    <option value="TWIPAY_OWNED">TwiPay Owned</option>
                    <option value="WHITE_LABEL">White Label</option>
                    <option value="ENTERPRISE_SOURCE">Enterprise Source</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Licensed To
                  <input name="licensedTo" defaultValue={profile?.licensedTo || ""} required className="pill-input" />
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={profile?.status || "ACTIVE"} className="pill-input">
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </label>
              </div>

              <label>
                Allowed Modules (Comma Separated)
                <input
                  name="allowedModules"
                  defaultValue={Array.isArray(profile?.allowedModules) ? profile.allowedModules.join(", ") : "wallet, utilities, events"}
                  required
                  className="pill-input"
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Support Mode
                  <select name="supportMode" defaultValue={profile?.supportMode || "OCTALVE_MANAGED"} className="pill-input">
                    <option value="SELF_MANAGED">Self Managed</option>
                    <option value="OCTALVE_MANAGED">Octalve Managed</option>
                    <option value="ENTERPRISE_SUPPORT">Enterprise Support</option>
                  </select>
                </label>
                <label>
                  License Reference
                  <input name="licenseReference" defaultValue={profile?.licenseReference || ""} className="pill-input" />
                </label>
              </div>

              <label>
                Audit Reason
                <input name="reason" defaultValue="Authorized deployment profile change" required className="pill-input" />
              </label>

              <button type="submit" className="btn-pill primary" style={{ height: "40px" }}>
                Prepare Deployment Change &rarr;
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveTarget && (
        <ApproveModal
          isOpen={!!approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={handleConfirmApprove}
          title="Approve Configuration Mutation"
          reference={approveTarget.targetKey || approveTarget.kind}
          amountText={approveTarget.kind}
          beneficiaryText="System Infrastructure"
          makerText={`Maker: ${approveTarget.preparedByUserId}`}
          railText="Owner Quorum Governance"
        />
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          isOpen={!!rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleConfirmReject}
          title="Reject Configuration Change"
          reference={rejectTarget.targetKey || rejectTarget.kind}
          minChars={20}
        />
      )}
    </OpsShell>
  );
}
