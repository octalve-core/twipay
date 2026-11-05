"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { opsGet, explainCode } from "../_lib/api";
import { deliveryRate } from "../_lib/delivery";

type Summary = { counts: { status: string; suppressed: boolean; count: number }[] };

/** No customer-specific inbox contents, subjects, destinations, or decrypt operations. */
export default function NotificationOperationsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const result = await opsGet<Summary>("/operations/notifications/delivery-summary");
      setSummary(result);
      setError("");
    } catch (cause: any) {
      setError(explainCode(cause.code, "ACCESS_DENIED"));
      setSummary(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const totalDelivered = summary?.counts.filter((c) => c.status === "DELIVERED").reduce((a, b) => a + b.count, 0) ?? 0;
  const totalSuppressed = summary?.counts.filter((c) => c.suppressed).reduce((a, b) => a + b.count, 0) ?? 0;
  const totalFailed = summary?.counts.filter((c) => ["FAILED", "BOUNCED"].includes(c.status)).reduce((a, b) => a + b.count, 0) ?? 0;

  return (
    <OpsShell
      title="Notification Delivery Health &amp; Telemetry"
      eyebrow="Aggregated Dispatch Health"
      actions={
        <button type="button" className="btn-pill" onClick={() => void refresh()}>
          ↻ Refresh Delivery Summary
        </button>
      }
    >
      <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
        <span>📡</span>
        <div>
          <strong>Aggregated delivery outcomes only:</strong> This view contains no customer names, destinations, message bodies, inbox contents or credentials. Recent MFA and a dedicated permission are required.
        </div>
      </div>

      {error ? (
        <div className="ops-banner danger">
          <span>🛑</span>
          <div>Unable to read delivery health ({error}).</div>
        </div>
      ) : !summary ? (
        <div className="ops-panel" style={{ textAlign: "center", color: "var(--text-muted)" }}>
          Loading delivery health telemetry...
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="metrics-grid-4">
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Delivered Dispatches</span>
                <span className="metric-value" style={{ color: "#059669" }}>
                  {totalDelivered.toLocaleString()}
                </span>
                <span className="metric-delta">Provider accepted</span>
              </div>
              <span style={{ fontSize: "24px" }}>✉️</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Suppressed Messages</span>
                <span className="metric-value" style={{ color: "#D97706" }}>
                  {totalSuppressed.toLocaleString()}
                </span>
                <span className="metric-delta">Customer opt-out</span>
              </div>
              <span style={{ fontSize: "24px" }}>🔕</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Delivery Failures</span>
                <span className="metric-value" style={{ color: totalFailed ? "#DC2626" : "inherit" }}>
                  {totalFailed.toLocaleString()}
                </span>
                <span className="metric-delta" style={{ color: totalFailed ? "#DC2626" : "#059669" }}>
                  {totalFailed ? "Requires triage" : "Zero bounces"}
                </span>
              </div>
              <span style={{ fontSize: "24px" }}>⚠️</span>
            </div>

            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Delivery rate</span>
                <span className="metric-value" style={{ color: "var(--brand-blue)" }}>
                  {deliveryRate(totalDelivered, totalFailed) ?? "No outcomes yet"}
                </span>
                <span className="metric-delta">Delivered of delivered + failed or bounced</span>
              </div>
              <span style={{ fontSize: "24px" }}>⚡</span>
            </div>
          </div>

          {/* Delivery Outcomes Data Table Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Aggregated Delivery Outcomes</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Provider acceptance is not proof of receipt. Suppressed optional support emails are not sent.
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
                ● Active Relay
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Provider Status State</th>
                  <th>Customer Preference Suppression</th>
                  <th>Aggregated Count</th>
                  <th style={{ textAlign: "right" }}>Privacy Scope</th>
                </tr>
              </thead>
              <tbody>
                {summary.counts.map((row) => {
                  const isSuccess = row.status === "DELIVERED" || row.status === "SENT";
                  const isFail = row.status === "FAILED" || row.status === "BOUNCED";

                  return (
                    <tr key={`${row.status}-${row.suppressed}`}>
                      <td>
                        <span
                          className="pill-badge"
                          style={{
                            background: isSuccess ? "var(--green-bg)" : isFail ? "var(--coral-bg)" : "var(--amber-bg)",
                            color: isSuccess ? "var(--green-text)" : isFail ? "var(--coral-text)" : "var(--amber-text)"
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <strong>{row.suppressed ? "Suppressed / Opted Out" : "Normal Dispatch"}</strong>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                          {row.suppressed ? "Recipient disabled category" : "Recipient opted in"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "14px" }}>
                          {row.count.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="pill-badge" style={{ background: "var(--surface-muted)", color: "var(--text-main)" }}>
                          Aggregate only &bull; Zero PII
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </OpsShell>
  );
}
