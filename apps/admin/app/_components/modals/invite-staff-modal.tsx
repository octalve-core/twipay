"use client";

import { useState } from "react";
import { ModalDialog } from "./modal-dialog";

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { email: string; roleCode: string; reason: string }) => Promise<void> | void;
}

const ROLES = [
  { code: "SUPPORT_AGENT", label: "SUPPORT_AGENT", desc: "Customer inquiries, hold escalations & ticket triage" },
  { code: "AUDITOR", label: "SECURITY_AUDITOR", desc: "Read-only access to immutable ledger and audit journals" },
  { code: "COMPLIANCE", label: "COMPLIANCE_OFFICER", desc: "KYC document review & identity verification approvals" }
];

export function InviteStaffModal({ isOpen, onClose, onConfirm }: InviteStaffModalProps) {
  const [email, setEmail] = useState("");
  const [roleCode, setRoleCode] = useState("SUPPORT_AGENT");
  const [reason, setReason] = useState("");
  const [enforceMfa, setEnforceMfa] = useState(true);
  const [loading, setLoading] = useState(false);

  const isValid = email.includes("@") && reason.trim().length >= 20;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    try {
      await onConfirm({ email: email.trim(), roleCode, reason: reason.trim() });
      onClose();
      setEmail("");
      setReason("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} wide>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="modal-badge-row">
          <div className="modal-avatar-badge modal-badge-blue">👤+</div>
          <div className="modal-title-wrap">
            <h3>Invite Operations Staff Member</h3>
            <p>Issue Role-Based Administrative Credentials &amp; Governance Bounds</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">&times;</button>
        </div>

        <div className="ops-banner info" style={{ margin: 0, padding: "12px 14px", fontSize: "12px" }}>
          <span>🛡️</span>
          <div>
            <strong>Two-Person Control Invariant:</strong> Proposed invitations stage for independent owner check. The recipient must register, enable MFA and explicitly accept.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="ops-form" style={{ gap: "6px" }}>
            <label>
              Work Email Address
              <input
                type="email"
                required
                className="pill-input"
                placeholder="colleague@twipay.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>
          <div className="ops-form" style={{ gap: "6px" }}>
            <label>
              Operational Department
              <select className="pill-input">
                <option>Settlements &amp; Treasury Operations</option>
                <option>Risk, AML &amp; Fraud Prevention</option>
                <option>Customer Support &amp; L1 Triage</option>
                <option>Security &amp; Compliance Audit</option>
              </select>
            </label>
          </div>
        </div>

        <div className="ops-form" style={{ gap: "8px" }}>
          <label>Administrative Role Delegation</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {ROLES.map((r) => (
              <label
                key={r.code}
                style={{
                  border: `1px solid ${roleCode === r.code ? "var(--brand-blue)" : "var(--border-subtle)"}`,
                  background: roleCode === r.code ? "var(--brand-blue-light)" : "#FFFFFF",
                  borderRadius: "12px",
                  padding: "10px",
                  display: "flex",
                  gap: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.code}
                  checked={roleCode === r.code}
                  onChange={() => setRoleCode(r.code)}
                />
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: roleCode === r.code ? "var(--brand-blue)" : "var(--text-main)" }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {r.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="ops-form" style={{ gap: "6px" }}>
          <label>
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Business Justification (20–500 chars)</span>
              <span style={{ color: reason.trim().length >= 20 ? "#047857" : "#DC2626", fontWeight: 700, fontSize: "11px" }}>
                {reason.trim().length} / 20 min chars
              </span>
            </span>
            <input
              type="text"
              required
              minLength={20}
              maxLength={500}
              className="pill-input"
              placeholder="e.g. Q4 Settlements Onboarding - Ticket OPS-9921"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={enforceMfa}
            onChange={(e) => setEnforceMfa(e.target.checked)}
          />
          <span>Enforce Hardware FIDO2 / WebAuthn MFA on first onboarding session</span>
        </label>

        <div className="modal-footer-actions">
          <button type="button" className="btn-pill" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-pill primary"
            disabled={loading || !isValid}
            style={{ padding: "0 24px" }}
          >
            {loading ? "Staging..." : "Stage Invitation for Checker →"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
