"use client";

import { useState } from "react";
import Link from "next/link";
import { OpsShell } from "../../_components/ops-shell";
import { money } from "../../_lib/api";
import { ApproveModal } from "../../_components/modals";

interface BeneficiaryItem {
  id: string;
  name: string;
  bankName: string;
  accountNumberMasked: string;
  amountMinor: bigint;
  feeMinor: bigint;
}

const INITIAL_BENEFICIARIES: BeneficiaryItem[] = [
  { id: "1", name: "Lagos Tech Fest Operations", bankName: "Access Bank", accountNumberMasked: "•••• 4912", amountMinor: 1450000000n, feeMinor: 5000n },
  { id: "2", name: "Abuja Creative Hub Escrow", bankName: "GTBank Plc", accountNumberMasked: "•••• 8821", amountMinor: 620000000n, feeMinor: 5000n },
  { id: "3", name: "Kano Logistics & Transport", bankName: "Zenith Bank", accountNumberMasked: "•••• 1092", amountMinor: 380000000n, feeMinor: 5000n }
];

export function BatchCalculatorPage() {
  const [items, setItems] = useState<BeneficiaryItem[]>(INITIAL_BENEFICIARIES);
  const [payoutRail, setPayoutRail] = useState("PROVIDUS_NIP");
  const [scheduledDate, setScheduledDate] = useState("Immediate (T+0)");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [message, setMessage] = useState("");

  const totalGrossMinor = items.reduce((acc, x) => acc + x.amountMinor, 0n);
  const totalFeesMinor = items.reduce((acc, x) => acc + x.feeMinor, 0n);
  const totalDebitMinor = totalGrossMinor + totalFeesMinor;

  function handleStageBatch() {
    setShowApproveModal(true);
  }

  return (
    <OpsShell
      title="Batch Payout Calculator &amp; Simulator"
      eyebrow="Automated Settlement Staging"
      actions={
        <Link href="/payouts" className="btn-pill">
          &larr; Back to Payout Queue
        </Link>
      }
    >
      <div className="ops-banner info">
        <span>⚡</span>
        <div>
          <strong>Batch Calculation Model:</strong> Simulates multi-destination disbursements with real-time NIBSS rail tariffs (₦50.00 fixed). Validates ledger reservation before submitting for secondary checker approval.
        </div>
      </div>

      {message && (
        <div className="ops-banner" style={{ background: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" }}>
          <span>✓</span>
          <div>{message}</div>
        </div>
      )}

      {/* Configuration & Summary Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "20px" }}>
        {/* Beneficiaries Preview Table */}
        <div className="data-table-card">
          <div className="table-header-bar">
            <div>
              <h3>Simulated Beneficiaries in Batch</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                3 commercial bank allocations scheduled for immediate dispatch
              </p>
            </div>
            <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
              {items.length} Beneficiaries
            </span>
          </div>

          <table className="ops-table">
            <thead>
              <tr>
                <th>Beneficiary Name</th>
                <th>Bank &amp; Account</th>
                <th style={{ textAlign: "right" }}>NIP Tariff</th>
                <th style={{ textAlign: "right" }}>Disbursement Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.name}</strong>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                      Verified KYC Tier 3
                    </span>
                  </td>
                  <td>
                    <div>{x.bankName}</div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {x.accountNumberMasked}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: "var(--text-muted)" }}>
                    {money(x.feeMinor)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="table-amount" style={{ color: "var(--brand-blue)" }}>
                      {money(x.amountMinor)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation Summary Card */}
        <div className="ops-panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2>Settlement Batch Breakdown</h2>

          <div className="ops-form" style={{ gap: "6px" }}>
            <label>
              Routing Switch Provider
              <select
                className="pill-input"
                value={payoutRail}
                onChange={(e) => setPayoutRail(e.target.value)}
              >
                <option value="PROVIDUS_NIP">Providus Bank NIP Live Rail (T+0)</option>
                <option value="STERLING_API">Sterling Bank NIP Corporate API</option>
                <option value="MONNIFY_DISB">Monnify Auto-Disbursement Engine</option>
              </select>
            </label>
          </div>

          <div className="ops-form" style={{ gap: "6px" }}>
            <label>
              Execution Schedule
              <select
                className="pill-input"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              >
                <option>Immediate (T+0 Live Settlement)</option>
                <option>Next Business Day Morning (08:00 AM WAT)</option>
                <option>Weekly Settlement Cycle (Friday)</option>
              </select>
            </label>
          </div>

          <div className="modal-summary-grid" style={{ margin: "4px 0" }}>
            <div className="summary-item-row">
              <span className="summary-item-label">Gross Beneficiary Total</span>
              <span className="summary-item-val">{money(totalGrossMinor)}</span>
            </div>
            <div className="summary-item-row">
              <span className="summary-item-label">Network Switching Fees (₦50 ea)</span>
              <span className="summary-item-val" style={{ color: "#D97706" }}>{money(totalFeesMinor)}</span>
            </div>
            <div className="summary-item-row" style={{ paddingTop: "8px", borderTop: "1px dashed var(--border-subtle)" }}>
              <span className="summary-item-label" style={{ fontWeight: 800, color: "var(--text-main)" }}>Total Ledger Debit</span>
              <span className="summary-item-val" style={{ color: "var(--brand-blue)", fontSize: "16px" }}>
                {money(totalDebitMinor)}
              </span>
            </div>
          </div>

          <button
            className="btn-pill primary"
            style={{ width: "100%", height: "42px", fontSize: "13px" }}
            onClick={handleStageBatch}
          >
            Stage Batch for Dual-Control Checker &rarr;
          </button>
        </div>
      </div>

      {/* Dual Control Confirmation Modal */}
      {showApproveModal && (
        <ApproveModal
          isOpen={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          onConfirm={(totp) => {
            setMessage(`Batch BATCH-202610-SIM01 staged and authorized with TOTP ${totp}. Forwarded to checker.`);
          }}
          reference="BATCH-202610-SIM01"
          amountText={money(totalDebitMinor)}
          beneficiaryText="3 Verified Organizer Accounts"
          railText="Providus Bank NIP Live Rail"
        />
      )}
    </OpsShell>
  );
}

export default BatchCalculatorPage;
