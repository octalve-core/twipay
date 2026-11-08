"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { opsGet, money, explainCode } from "../_lib/api";

export default function OwnerOverview() {
  const [data, setData] = useState<any>();
  const [risk, setRisk] = useState<any>();
  const [riskError, setRiskError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    opsGet<any>("/operations/owner/overview")
      .then(setData)
      .catch((e) => setError(explainCode(e.code, "REQUEST_FAILED")));

    opsGet<any>("/operations/owner/risk")
      .then(setRisk)
      .catch((e) => setRiskError(explainCode(e.code, "REQUEST_FAILED")));
  }, []);

  const report = data?.operations;

  return (
    <OpsShell
      title="Owner control centre"
      eyebrow="Executive Sovereign Control"
      actions={
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/owner/staff" className="btn-pill primary">
            Staff Governance &rarr;
          </Link>
          <Link href="/owner/customers" className="btn-pill">
            Customer Portfolio &rarr;
          </Link>
        </div>
      }
    >
      <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
        <span>👑</span>
        <div>
          <strong>Operational evidence only:</strong> All figures are observed backend records, not live settlements or launch authorization. Sensitive staff actions require independent owner approval and recent MFA.
        </div>
      </div>

      {error ? (
        <Fail code={error} />
      ) : !data ? (
        <Wait />
      ) : (
        <>
          {/* Executive Metrics Grid */}
          <div className="metrics-grid-4">
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Registered Customers</span>
                <span className="metric-value">{report.users?.toLocaleString?.() ?? report.users}</span>
                <span className="metric-delta">Active merchant accounts</span>
              </div>
              <span style={{ fontSize: "24px" }}>🏢</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Open Disputes</span>
                <span className="metric-value" style={{ color: report.queues?.openDisputes ? "#B45309" : "inherit" }}>
                  {report.queues?.openDisputes ?? 0}
                </span>
                <span className="metric-delta">Chargeback exposure</span>
              </div>
              <span style={{ fontSize: "24px" }}>↩️</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Reconciliation Cases</span>
                <span className="metric-value">{report.queues?.openReconciliation ?? 0}</span>
                <span className="metric-delta">Bank clearing hold</span>
              </div>
              <span style={{ fontSize: "24px" }}>⚠️</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Support Tickets</span>
                <span className="metric-value" style={{ color: "var(--brand-blue)" }}>
                  {data.openSupportCases ?? 0}
                </span>
                <span className="metric-delta">L1 escalations</span>
              </div>
              <span style={{ fontSize: "24px" }}>🎧</span>
            </div>
          </div>

          {/* Account Status Distribution & Financial Activity Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "20px" }}>
            {/* Account Status Card */}
            <div className="ops-panel">
              <h2>Customer Account Status Distribution</h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
                Current portfolio standing across enrolled business entities
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(data.customersByStatus || []).map((s: any) => (
                  <div
                    key={s.status}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--surface-subtle)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)"
                    }}
                  >
                    <span className="pill-badge" style={{ background: "#FFFFFF", color: "var(--text-main)", border: "1px solid var(--border-subtle)" }}>
                      {s.status}
                    </span>
                    <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px" }}>
                      {s.count}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* 30-Day Activity Table Card */}
            <div className="data-table-card">
              <div className="table-header-bar">
                <div>
                  <h3>Financial Activity (Last 30 Days)</h3>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {new Date(report.period.from).toLocaleDateString()} to {new Date(report.period.to).toLocaleDateString()}
                  </p>
                </div>
                <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                  Observed
                </span>
              </div>

              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Count</th>
                    <th style={{ textAlign: "right" }}>Observed Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.transactions || []).map((r: any) => (
                    <tr key={`${r.type}-${r.status}`}>
                      <td><strong>{r.type}</strong></td>
                      <td>
                        <span className="pill-badge" style={{ background: "var(--surface-muted)", color: "var(--text-main)" }}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.count}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="table-amount" style={{ color: "var(--brand-blue)" }}>
                          {money(r.amountMinor)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Risk & Circuit Breaker Summary */}
          <div className="ops-panel">
            <h2>Operational Risk, Provider Health &amp; Quorum Backlog</h2>
            {riskError ? (
              <p style={{ color: "var(--coral-text)" }}>Risk summary unavailable: {riskError}</p>
            ) : !risk ? (
              <p style={{ color: "var(--text-muted)" }}>Loading independently observed risk data…</p>
            ) : (
              <>
                <div className="metrics-grid-4" style={{ marginBottom: "16px" }}>
                  <div className="metric-card">
                    <div className="metric-data">
                      <span className="metric-label">Provider operations · failed/unknown</span>
                      <span className="metric-value" style={{ color: "#DC2626" }}>
                        {risk.providerOutcomes
                          .filter((r: any) => ["FAILED", "UNKNOWN"].includes(r.status))
                          .reduce((n: number, r: any) => n + r.count, 0)}
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-data">
                      <span className="metric-label">Non-Closed Circuits</span>
                      <span className="metric-value" style={{ color: "#B45309" }}>
                        {risk.providerCircuits.filter((r: any) => r.circuitState !== "CLOSED").length}
                      </span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-data">
                      <span className="metric-label">Check-ins in Period</span>
                      <span className="metric-value">{risk.tickets.checkInsInPeriod}</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-data">
                      <span className="metric-label">Pending Owner Approvals</span>
                      <span className="metric-value" style={{ color: "var(--brand-blue)" }}>
                        {risk.pendingOwnerReviews.staff + risk.pendingOwnerReviews.customerSuspensions}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="data-table-card">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Capability</th>
                        <th>Observed Circuit</th>
                        <th style={{ textAlign: "right" }}>Last Failure Incident</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risk.providerCircuits.map((p: any) => (
                        <tr key={`${p.providerCode}:${p.capability}`}>
                          <td><strong>{p.providerCode}</strong></td>
                          <td>{p.capability}</td>
                          <td>
                            <span
                              className="pill-badge"
                              style={{
                                background: p.circuitState === "CLOSED" ? "var(--green-bg)" : "var(--coral-bg)",
                                color: p.circuitState === "CLOSED" ? "var(--green-text)" : "var(--coral-text)"
                              }}
                            >
                              {p.circuitState}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--text-muted)" }}>
                            {p.lastFailureAt ? new Date(p.lastFailureAt).toLocaleString() : "None recorded"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </OpsShell>
  );
}
