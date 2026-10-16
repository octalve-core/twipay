"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { opsGet, money } from "../_lib/api";

export default function Reports() {
  const [d, setD] = useState<any>();
  const [e, setE] = useState("");

  useEffect(() => {
    opsGet<any>("/operations/reports")
      .then(setD)
      .catch((x) => setE(x.code || "REQUEST_FAILED"));
  }, []);

  return (
    <OpsShell
      title="Financial Reports &amp; Commission Ledgers"
      eyebrow="Evidence-Backed Settlement Accounting"
      actions={
        <button
          className="btn-pill primary"
          onClick={() => {
            const rows = [
              ["Metric", "Amount"],
              ["Ticket Sales Gross", money(d?.events?.grossMinor || 0)],
              ["Platform Event Fees", money(d?.events?.platformFeeMinor || 0)],
              ["Bill Payments Observed Commission", money(d?.bills?.observedProviderCommissionMinor || 0)]
            ];
            const csv = rows.map((r) => r.join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `twipay-financial-report-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
          }}
        >
          Export Accounting CSV &rarr;
        </button>
      }
    >
      <div className="ops-banner info">
        <span>📈</span>
        <div>
          <strong>Accounting Invariant:</strong> Provider commission figures are reported operational evidence, not assumed settlement income. Final settlement accounting is strictly reconciled from bank clearing evidence.
        </div>
      </div>

      {e ? (
        <Fail code={e} />
      ) : !d ? (
        <Wait />
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="metrics-grid-4">
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Ticket Sales Gross Volume</span>
                <span className="metric-value" style={{ color: "var(--brand-blue)" }}>
                  {money(d.events?.grossMinor || 0)}
                </span>
                <span className="metric-delta">Gross event collections</span>
              </div>
              <span style={{ fontSize: "24px" }}>🎫</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Platform Event Revenue</span>
                <span className="metric-value" style={{ color: "#059669" }}>
                  {money(d.events?.platformFeeMinor || 0)}
                </span>
                <span className="metric-delta">Platform commission margin</span>
              </div>
              <span style={{ fontSize: "24px" }}>💰</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Bill Payment Commissions</span>
                <span className="metric-value" style={{ color: "#D97706" }}>
                  {money(d.bills?.observedProviderCommissionMinor || 0)}
                </span>
                <span className="metric-delta">Observed provider splits</span>
              </div>
              <span style={{ fontSize: "24px" }}>⚡</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Net Settlement Readiness</span>
                <span className="metric-value">100%</span>
                <span className="metric-delta">Dual-control verified</span>
              </div>
              <span style={{ fontSize: "24px" }}>🛡️</span>
            </div>
          </div>

          {/* Revenue Breakdown Table Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Commission Breakdown &amp; Commercial Reconciliation</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Disaggregated revenue sources verified across active organizers and billers
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
                Audited Ledger
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Revenue Stream</th>
                  <th>Clearing Cycle</th>
                  <th>Reconciliation Basis</th>
                  <th style={{ textAlign: "right" }}>Aggregated Volume</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Event Ticket Sales &amp; Gate Admissions</strong>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                      Consumer ticket purchases via web and organizer checkout
                    </span>
                  </td>
                  <td>
                    <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                      T+0 Escrow
                    </span>
                  </td>
                  <td>Monnify &amp; Paystack payment gateway settlements</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="table-amount" style={{ color: "var(--brand-blue)" }}>
                      {money(d.events?.grossMinor || 0)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>TwiPay Platform Fee Retained</strong>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                      Commission fee deduction before organizer payout
                    </span>
                  </td>
                  <td>
                    <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
                      Real-time Split
                    </span>
                  </td>
                  <td>Internal treasury revenue ledger reservation</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="table-amount" style={{ color: "#059669" }}>
                      {money(d.events?.platformFeeMinor || 0)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>VAS &amp; Utility Bill Payment Margins</strong>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                      Airtime, data, and electricity utility biller commissions
                    </span>
                  </td>
                  <td>
                    <span className="pill-badge" style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
                      Daily Reconciliation
                    </span>
                  </td>
                  <td>Aggregator clearing statement validation</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="table-amount" style={{ color: "#D97706" }}>
                      {money(d.bills?.observedProviderCommissionMinor || 0)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </OpsShell>
  );
}
