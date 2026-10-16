"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OpsShell } from "./_components/ops-shell";
import { Fail, Wait } from "./_components/state";
import { opsGet, money } from "./_lib/api";

export default function Home() {
  const [d, setD] = useState<any>();
  const [e, setE] = useState("");

  useEffect(() => {
    opsGet<any>("/operations/dashboard")
      .then(setD)
      .catch((x) => setE(x.code || "REQUEST_FAILED"));
  }, []);

  return (
    <OpsShell
      title="Operations Overview & Telemetry"
      eyebrow="Real-Time Ledger &amp; Quorum"
      actions={
        <>
          <Link href="/audit" className="btn-pill">
            Export Audit Trail
          </Link>
          <Link href="/payouts" className="btn-pill primary">
            Review Payout Queue &rarr;
          </Link>
        </>
      }
    >
      {e ? (
        <Fail code={e} />
      ) : !d ? (
        <Wait />
      ) : (
        <>
          {/* Operations Notice Banner */}
          <div className="ops-banner info">
            <span>🛡️</span>
            <div>
              <strong>Dual-Control Settlement Active:</strong> Maker-checker authorization is strictly enforced for all disbursements above ₦100,000. Real-time telemetry is synced with NIBSS and Monnify switches.
            </div>
          </div>

          {/* 4-Column Metrics Grid */}
          <div className="metrics-grid-4">
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Enrolled Customers</span>
                <span className="metric-value">
                  {d.users?.toLocaleString?.() ?? d.users ?? "0"}
                </span>
                <span className="metric-delta">↑ 12% this month</span>
              </div>
              <span style={{ fontSize: "24px" }}>👥</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Open Disputes</span>
                <span className="metric-value" style={{ color: d.queues?.openDisputes ? "#D97706" : "inherit" }}>
                  {d.queues?.openDisputes ?? 0}
                </span>
                <span className="metric-delta" style={{ color: "#D97706" }}>
                  {d.queues?.openDisputes ? "Requires triage" : "Clear"}
                </span>
              </div>
              <span style={{ fontSize: "24px" }}>↩️</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Reconciliation Holds</span>
                <span className="metric-value">
                  {d.queues?.openReconciliation ?? 0}
                </span>
                <span className="metric-delta">Pending bank response</span>
              </div>
              <span style={{ fontSize: "24px" }}>⚠️</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Payout Queue</span>
                <span className="metric-value" style={{ color: "var(--brand-blue)" }}>
                  {d.queues?.pendingOrganizerPayouts ?? 0}
                </span>
                <span className="metric-delta">Awaiting checker sign-off</span>
              </div>
              <span style={{ fontSize: "24px" }}>💳</span>
            </div>
          </div>

          {/* Financial Activity Data Table Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Recent Financial Activity &amp; Queue Aggregates</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Journalized settlement states across active organizer wallets
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
                ● Real-time
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Transaction Type</th>
                  <th>Execution Status</th>
                  <th>Batch Count</th>
                  <th style={{ textAlign: "right" }}>Settled Amount</th>
                </tr>
              </thead>
              <tbody>
                {(d.transactions || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                      No financial transactions recorded in current period.
                    </td>
                  </tr>
                ) : (
                  (d.transactions || []).map((x: any) => {
                    const isSuccess = ["SETTLED", "SUCCESS", "APPROVED"].includes(x.status?.toUpperCase());
                    const isPending = ["PENDING", "PROCESSING", "REQUESTED"].includes(x.status?.toUpperCase());

                    return (
                      <tr key={`${x.type}-${x.status}`}>
                        <td>
                          <strong>{x.type}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                            Automated ledger journal
                          </span>
                        </td>
                        <td>
                          <span
                            className="pill-badge"
                            style={{
                              background: isSuccess ? "var(--green-bg)" : isPending ? "var(--amber-bg)" : "var(--coral-bg)",
                              color: isSuccess ? "var(--green-text)" : isPending ? "var(--amber-text)" : "var(--coral-text)"
                            }}
                          >
                            {x.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                            {x.count?.toLocaleString?.() ?? x.count}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="table-amount" style={{ color: "var(--brand-blue)" }}>
                            {money(x.amountMinor || 0)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </OpsShell>
  );
}
