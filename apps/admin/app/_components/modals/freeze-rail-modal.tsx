"use client";

import { useState } from "react";
import { ModalDialog } from "./modal-dialog";

interface FreezeRailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  providerName: string;
  expectedPhrase?: string;
  slaText?: string;
  queuedTxns?: string;
}

export function FreezeRailModal({
  isOpen,
  onClose,
  onConfirm,
  providerName,
  expectedPhrase = "FREEZE-RAIL-01",
  slaText = "61.2% (Degraded • 18 timeouts)",
  queuedTxns = "₦18,400,000.00 (1,420 Txns)"
}: FreezeRailModalProps) {
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmed = phrase.trim().toUpperCase() === expectedPhrase.toUpperCase();

  async function handleSubmit() {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
      setPhrase("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose}>
      <div className="modal-badge-row">
        <div className="modal-avatar-badge modal-badge-amber">⚡</div>
        <div className="modal-title-wrap">
          <h3 style={{ color: "#B45309" }}>Disable Provider Routing Rail</h3>
          <p>Emergency Circuit Breaker Trigger &bull; Automated Outage Failover</p>
        </div>
        <button className="modal-close-btn" onClick={onClose} title="Close">&times;</button>
      </div>

      <div className="ops-banner" style={{ margin: 0, padding: "12px 14px", fontSize: "12px" }}>
        <span>⚠️</span>
        <div>
          <strong>High Blast Radius:</strong> Freezing <strong>{providerName}</strong> will immediately halt automated traffic routing. Queued transactions will divert to secondary rails.
        </div>
      </div>

      <div className="modal-summary-grid">
        <div className="summary-item-row">
          <span className="summary-item-label">Target Provider Rail</span>
          <span className="summary-item-val">{providerName}</span>
        </div>
        <div className="summary-item-row">
          <span className="summary-item-label">Health & SLA</span>
          <span className="summary-item-val" style={{ color: "#DC2626" }}>{slaText}</span>
        </div>
        <div className="summary-item-row">
          <span className="summary-item-label">Queued Exposure</span>
          <span className="summary-item-val">{queuedTxns}</span>
        </div>
        <div className="summary-item-row">
          <span className="summary-item-label">Failover Secondary</span>
          <span className="summary-item-val" style={{ color: "#059669" }}>Sterling Bank API (Operational)</span>
        </div>
      </div>

      <div className="ops-form" style={{ gap: "6px" }}>
        <label>
          <span>Type confirmation phrase below: <code style={{ background: "#FEF3C7", color: "#92400E", padding: "1px 6px", borderRadius: "4px" }}>{expectedPhrase}</code></span>
          <input
            type="text"
            className="pill-input"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={`Type ${expectedPhrase}`}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
          />
        </label>
      </div>

      <div className="modal-footer-actions">
        <button className="btn-pill" onClick={onClose} disabled={loading}>
          Keep Rail Active
        </button>
        <button
          className="btn-pill danger"
          onClick={handleSubmit}
          disabled={loading || !isConfirmed}
          style={{ background: "#DC2626", color: "#FFFFFF", padding: "0 22px" }}
        >
          {loading ? "Freezing..." : "Freeze Rail Immediately →"}
        </button>
      </div>
    </ModalDialog>
  );
}
