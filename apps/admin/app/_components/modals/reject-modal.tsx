"use client";

import { useState } from "react";
import { ModalDialog } from "./modal-dialog";

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notifyMerchant: boolean) => Promise<void> | void;
  title?: string;
  reference: string;
  amountText?: string;
  beneficiaryText?: string;
  minChars?: number;
  maxChars?: number;
}

export function RejectModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Reject Payout Instruction",
  reference,
  amountText,
  beneficiaryText,
  minChars = 20,
  maxChars = 500
}: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const charCount = reason.trim().length;
  const isValid = charCount >= minChars && charCount <= maxChars;

  async function handleSubmit() {
    setTouched(true);
    if (!isValid) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim(), notify);
      onClose();
      setReason("");
      setTouched(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose}>
      <div className="modal-badge-row">
        <div className="modal-avatar-badge modal-badge-red">⚠️</div>
        <div className="modal-title-wrap">
          <h3 style={{ color: "#DC2626" }}>{title}</h3>
          <p>Immediate Reversal &bull; Mandatory Compliance Audit Reason</p>
        </div>
        <button className="modal-close-btn" onClick={onClose} title="Close">&times;</button>
      </div>

      <div className="ops-banner danger" style={{ margin: 0, padding: "12px 14px", fontSize: "12px" }}>
        <span>🛑</span>
        <div>
          <strong>Irreversible Action:</strong> Rejecting <strong>{reference}</strong> releases the ledger hold back to the merchant escrow and halts commercial bank dispatch.
        </div>
      </div>

      {(amountText || beneficiaryText) && (
        <div className="modal-summary-grid">
          <div className="summary-item-row">
            <span className="summary-item-label">Reference</span>
            <span className="summary-item-val">{reference}</span>
          </div>
          {amountText && (
            <div className="summary-item-row">
              <span className="summary-item-label">Amount</span>
              <span className="summary-item-val" style={{ color: "#DC2626" }}>{amountText}</span>
            </div>
          )}
          {beneficiaryText && (
            <div className="summary-item-row">
              <span className="summary-item-label">Beneficiary</span>
              <span className="summary-item-val">{beneficiaryText}</span>
            </div>
          )}
        </div>
      )}

      <div className="ops-form" style={{ gap: "6px" }}>
        <label>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Mandatory Rejection Justification</span>
            <span style={{ color: isValid ? "#047857" : "#DC2626", fontWeight: 700, fontSize: "11px" }}>
              {charCount} / {minChars} min chars
            </span>
          </span>
          <textarea
            className="modal-textarea"
            rows={3}
            placeholder="Provide specific AML, discrepancy, or operational justification for rejection (minimum 20 characters)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: "100%",
              borderRadius: "10px",
              border: `1px solid ${touched && !isValid ? "#F87171" : "#CBD5E1"}`,
              padding: "10px 14px",
              fontSize: "13px",
              fontFamily: "inherit"
            }}
          />
        </label>
        {touched && !isValid && (
          <span style={{ color: "#DC2626", fontSize: "11px" }}>
            Rejection justification must be between {minChars} and {maxChars} characters.
          </span>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
        />
        <span>Dispatch automated incident notification to merchant operations contact</span>
      </label>

      <div className="modal-footer-actions">
        <button className="btn-pill" onClick={onClose} disabled={loading}>
          Dismiss
        </button>
        <button
          className="btn-pill danger"
          onClick={handleSubmit}
          disabled={loading || !isValid}
          style={{ background: "#DC2626", color: "#FFFFFF", padding: "0 20px" }}
        >
          {loading ? "Rejecting..." : "Confirm & Reject Payout"}
        </button>
      </div>
    </ModalDialog>
  );
}
