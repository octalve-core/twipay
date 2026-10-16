"use client";

import { useState } from "react";
import { ModalDialog } from "./modal-dialog";

interface ApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totp: string) => Promise<void> | void;
  title?: string;
  reference: string;
  amountText: string;
  beneficiaryText: string;
  makerText?: string;
  railText?: string;
}

export function ApproveModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Approve Batch Disbursement",
  reference,
  amountText,
  beneficiaryText,
  makerText = "samuel.maker@twipay.com (08:42 AM WAT)",
  railText = "Providus Bank NIP Live Bridge"
}: ApproveModalProps) {
  const [totp, setTotp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);

  function handleTotpChange(index: number, val: string) {
    if (val.length > 1) val = val.slice(-1);
    const updated = [...totp];
    updated[index] = val;
    setTotp(updated);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`totp-box-${index + 1}`);
      nextInput?.focus();
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await onConfirm(totp.join(""));
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose}>
      <div className="modal-badge-row">
        <div className="modal-avatar-badge modal-badge-green">🛡️</div>
        <div className="modal-title-wrap">
          <h3>{title}</h3>
          <p>Dual-Control Maker-Checker Release &bull; Live Settlement</p>
        </div>
        <button className="modal-close-btn" onClick={onClose} title="Close">&times;</button>
      </div>

      <div className="ops-banner info" style={{ margin: 0, padding: "12px 14px", fontSize: "12px" }}>
        <span>ℹ️</span>
        <div>
          <strong>Maker-Checker Policy Invariant:</strong> You are acting as Authorizing Checker for reference <strong>{reference}</strong>. Once approved, live funds settle immediately.
        </div>
      </div>

      <div className="modal-summary-grid">
        <div className="summary-item-row">
          <span className="summary-item-label">Reference</span>
          <span className="summary-item-val">{reference}</span>
        </div>
        <div className="summary-item-row">
          <span className="summary-item-label">Total Settlement</span>
          <span className="summary-item-val" style={{ color: "var(--brand-blue)", fontSize: "14px" }}>{amountText}</span>
        </div>
        <div className="summary-item-row">
          <span className="summary-item-label">Beneficiary</span>
          <span className="summary-item-val">{beneficiaryText}</span>
        </div>
        <div className="summary-item-row">
          <span className="summary-item-label">Maker Signature</span>
          <span className="summary-item-val">{makerText}</span>
        </div>
        <div className="summary-item-row">
          <span className="summary-item-label">Routing Rail</span>
          <span className="summary-item-val">{railText}</span>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "4px" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
          Enter 6-Digit Authenticator TOTP Challenge Code
        </label>
        <div className="totp-input-grid">
          {totp.map((digit, idx) => (
            <input
              key={idx}
              id={`totp-box-${idx}`}
              type="text"
              maxLength={1}
              className="totp-box"
              value={digit}
              onChange={(e) => handleTotpChange(idx, e.target.value)}
              placeholder="•"
            />
          ))}
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Hardware Token or Google Authenticator MFA
        </span>
      </div>

      <div className="modal-footer-actions">
        <button className="btn-pill" onClick={onClose} disabled={loading}>
          Hold for Review
        </button>
        <button
          className="btn-pill primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ padding: "0 24px" }}
        >
          {loading ? "Releasing..." : "Authorize & Release Funds →"}
        </button>
      </div>
    </ModalDialog>
  );
}
