"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { opsGet, money, explainCode } from "../_lib/api";

export default function Compliance() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");

  useEffect(() => {
    opsGet<any>("/operations/compliance")
      .then(setData)
      .catch((x) => setError(explainCode(x.code, "REQUEST_FAILED")));
  }, []);

  return (
    <OpsShell
      title="Compliance &amp; Identity Review"
      eyebrow="Sanctions &amp; AML Assurance"
    >
      <div className="ops-banner info">
        <span>🛡️</span>
        <div>
          <strong>Data minimization Invariant:</strong> This view exposes status, consent metadata and masked identity digits only. BVN/NIN ciphertext and raw provider responses are never returned to this client console.
        </div>
      </div>

      {error ? (
        <Fail code={error} />
      ) : !data ? (
        <Wait />
      ) : (
        <>
          {/* Identity Verification Queue Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Identity Verification &amp; Tier Upgrade Queue</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Real-time BVN, CAC, and contact verification audit records
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                {data.identity?.verifications?.length || 0} Verifications
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Customer User</th>
                  <th>ID Scheme &amp; Last-4</th>
                  <th>Verification Status</th>
                  <th style={{ textAlign: "right" }}>Verification Provider &amp; Consent</th>
                </tr>
              </thead>
              <tbody>
                {(data.identity?.verifications || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                      No pending identity verifications in queue.
                    </td>
                  </tr>
                ) : (
                  data.identity.verifications.map((v: any) => {
                    const isVerified = ["VERIFIED", "PASSED", "SUCCESS"].includes(v.status?.toUpperCase());
                    const isPending = ["PENDING", "SUBMITTED"].includes(v.status?.toUpperCase());

                    return (
                      <tr key={v.id}>
                        <td>
                          <strong>{v.user?.email || "Unknown User"}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                            {v.user?.givenName || ""} {v.user?.familyName || ""}
                          </span>
                        </td>
                        <td>
                          <span className="pill-badge" style={{ background: "var(--surface-muted)", color: "var(--text-main)" }}>
                            {v.type}
                          </span>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--brand-blue)", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>
                            •••• {v.identifierLast4 || "—"}
                          </span>
                        </td>
                        <td>
                          <span
                            className="pill-badge"
                            style={{
                              background: isVerified ? "var(--green-bg)" : isPending ? "var(--amber-bg)" : "var(--coral-bg)",
                              color: isVerified ? "var(--green-text)" : isPending ? "var(--amber-text)" : "var(--coral-text)"
                            }}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <strong>{v.providerCode}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                            Consent: {new Date(v.consentRecordedAt).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Recent Disputes Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Recent Disputes &amp; AML Risk Cases</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Disputes filed by issuing banks or consumers requiring compliance sign-off
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--coral-bg)", color: "var(--coral-text)" }}>
                {data.disputes?.cases?.length || 0} Cases
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Dispute Reference</th>
                  <th>Customer Account</th>
                  <th>Resolution Status</th>
                  <th style={{ textAlign: "right" }}>Linked Financial Transaction</th>
                </tr>
              </thead>
              <tbody>
                {(data.disputes?.cases || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                      No active dispute cases in review.
                    </td>
                  </tr>
                ) : (
                  data.disputes.cases.map((d: any) => (
                    <tr key={d.reference}>
                      <td>
                        <span className="table-id-link">{d.reference}</span>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {d.category} &bull; Code: {d.reasonCode}
                        </span>
                      </td>
                      <td>
                        <strong>{d.user?.email || "Unknown"}</strong>
                      </td>
                      <td>
                        <span className="pill-badge" style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="table-id-link" style={{ fontSize: "12px" }}>
                          {d.financialTransaction?.reference}
                        </span>
                        <span style={{ display: "block", fontSize: "12px", color: "var(--brand-blue)", fontWeight: 700 }}>
                          {money(d.financialTransaction?.amountMinor || 0, d.financialTransaction?.currency || "NGN")} &bull; {d.financialTransaction?.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </OpsShell>
  );
}
