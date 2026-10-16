"use client";

import { useState } from "react";
import { ModalDialog } from "./modal-dialog";

interface TierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { customerId: string; tierCode: string; maxPerIntentMinor: string; verificationUuid: string }) => Promise<void> | void;
  initialCustomerId?: string;
}

export function TierModal({ isOpen, onClose, onConfirm, initialCustomerId = "" }: TierModalProps) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [tierCode, setTierCode] = useState("TIER_2");
  const [maxPerIntentMinor, setMaxPerIntentMinor] = useState("10000000");
  const [verificationUuid, setVerificationUuid] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = customerId.length >= 10 && verificationUuid.length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    try {
      await onConfirm({
        customerId: customerId.trim(),
        tierCode,
        maxPerIntentMinor: maxPerIntentMinor.trim(),
        verificationUuid: verificationUuid.trim()
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} wide>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="modal-badge-row">
          <div className="modal-avatar-badge modal-badge-purple">🎚️</div>
          <div className="modal-title-wrap">
            <h3>Prepare Financial Tier Review</h3>
            <p>Configure Customer Limits, Settlement Ceiling &amp; Maker-Checker Triggers</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">&times;</button>
        </div>

        <div className="ops-banner info" style={{ margin: 0, padding: "12px 14px", fontSize: "12px" }}>
          <span>ℹ️</span>
          <div>
            <strong>Dual-Control Requirement:</strong> Tier upgrades expand payout capabilities and require independent checker approval with verified BVN/NIN audit trail.
          </div>
        </div>

        <div className="ops-form" style={{ gap: "6px" }}>
          <label>
            Customer UUID
            <input
              type="text"
              required
              className="pill-input"
              placeholder="e4fd536b-22e5-4f2d-9a61-7c48113994c5"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="ops-form" style={{ gap: "6px" }}>
            <label>
              Target Tier Profile
              <select
                className="pill-input"
                value={tierCode}
                onChange={(e) => setTierCode(e.target.value)}
              >
                <option value="TIER_1">Tier 1 (Unverified Contact • ₦50K Intent)</option>
                <option value="TIER_2">Tier 2 (Verified Contact + BVN • ₦100K Intent)</option>
                <option value="TIER_3">Tier 3 (Corporate CAC + Enhanced KYC • ₦5M Intent)</option>
              </select>
            </label>
          </div>
          <div className="ops-form" style={{ gap: "6px" }}>
            <label>
              Max Per Intent Minor Units (e.g. 10000000 = ₦100,000)
              <input
                type="text"
                required
                className="pill-input"
                value={maxPerIntentMinor}
                onChange={(e) => setMaxPerIntentMinor(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="ops-form" style={{ gap: "6px" }}>
          <label>
            Verified Identity Check UUID (Evidence Record)
            <input
              type="text"
              required
              className="pill-input"
              placeholder="b182f091-a182-4112-9c12-718291001291"
              value={verificationUuid}
              onChange={(e) => setVerificationUuid(e.target.value)}
            />
          </label>
        </div>

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
            {loading ? "Submitting..." : "Submit Review for Checker →"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
