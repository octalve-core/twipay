"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { money, opsGet, opsMutation } from "../_lib/api";
import { ModalDialog } from "../_components/modals";

type Case = {
  id: string;
  type: string;
  status: string;
  summary: string;
  createdAt: string;
  prepared: boolean;
  preparedBy: string | null;
  financial: null | {
    reference: string;
    status: string;
    type: string;
    amountMinor: string;
    feeMinor: string;
    currency: string;
    holds: { id: string; status: string }[];
  };
  provider: null | { providerCode: string; status: string; type: string };
};

type Hold = {
  id: string;
  reference: string;
  transactionStatus: string;
  status: string;
  amountMinor: string;
  currency: string;
  createdAt: string;
  expiresAt: string | null;
};

type Queue = { cases: Case[]; activeHolds: Hold[]; bounded: boolean };

export default function FinancialExceptionsPage() {
  const [data, setData] = useState<Queue>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [prepareCaseId, setPrepareCaseId] = useState<string | null>(null);
  const [prepareEvidenceNote, setPrepareEvidenceNote] = useState("");
  const [closeCaseId, setCloseCaseId] = useState<string | null>(null);

  async function load() {
    try {
      setData(await opsGet<Queue>("/operations/financial-exceptions"));
      setError("");
    } catch (cause: any) {
      setError(cause.code ?? "REQUEST_FAILED");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleConfirmPrepare() {
    if (!prepareCaseId || prepareEvidenceNote.trim().length < 20) return;
    try {
      await opsMutation(`/operations/financial-exceptions/${prepareCaseId}/prepare`, { note: prepareEvidenceNote.trim() });
      setMessage("Review prepared. An independent checker is required.");
      setPrepareCaseId(null);
      setPrepareEvidenceNote("");
      await load();
    } catch (cause: any) {
      setMessage(cause.code ?? "PREPARE_BLOCKED");
    }
  }

  async function handleConfirmClose() {
    if (!closeCaseId) return;
    try {
      await opsMutation(`/operations/financial-exceptions/${closeCaseId}/close-verified-status`);
      setMessage("Verified status review closed without altering ledger funds.");
      setCloseCaseId(null);
      await load();
    } catch (cause: any) {
      setMessage(cause.code ?? "CLOSURE_BLOCKED");
    }
  }

  return (
    <OpsShell
      title="Financial Exceptions &amp; Wallet Holds"
      eyebrow="Immutable Reconciliation Review"
    >
      <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
        <span>⚠️</span>
        <div>
          <strong>Review only Invariant:</strong> Unknown provider outcomes, disputed credits, and active holds must remain unsettled until independently verified. Review actions never credit wallets, release holds, submit payouts, or rewrite ledger entries.
        </div>
      </div>

      {error ? (
        <Fail code={error} />
      ) : !data ? (
        <Wait />
      ) : (
        <>
          {message && (
            <div className="ops-banner info" style={{ padding: "10px 14px", fontSize: "12px" }}>
              <span>ℹ️</span>
              <div>{message}</div>
            </div>
          )}

          {/* Reconciliation Cases Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Open Reconciliation Cases (FIFO Ordered)</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Mismatches between commercial bank switches and double-entry ledger state
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
                {data.cases.length} Unresolved
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Case Identifier &amp; Summary</th>
                  <th>Linked Financial Reference</th>
                  <th>Ledger / Provider State</th>
                  <th style={{ textAlign: "right" }}>Review Action</th>
                </tr>
              </thead>
              <tbody>
                {data.cases.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                      No open reconciliation cases in this bounded view.
                    </td>
                  </tr>
                ) : (
                  data.cases.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.type}</strong>
                        <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {item.summary}
                        </span>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-soft)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span className="table-id-link">
                          {item.financial?.reference ?? "No linked transaction"}
                        </span>
                        {item.financial && (
                          <span style={{ display: "block", fontSize: "12px", color: "var(--brand-blue)", fontWeight: 700 }}>
                            {money(item.financial.amountMinor, item.financial.currency)} &bull; {item.financial.type}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span className="pill-badge" style={{ background: "var(--surface-muted)", color: "var(--text-main)" }}>
                            Ledger: {item.financial?.status ?? "Unknown"}
                          </span>
                          <span className="pill-badge" style={{ background: "var(--surface-muted)", color: "var(--text-main)" }}>
                            Rail: {item.provider?.status ?? "Unknown"}
                          </span>
                        </div>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                          Active holds: {item.financial?.holds.filter((h) => h.status === "ACTIVE").length ?? 0} &bull;{" "}
                          <strong style={{ color: item.prepared ? "#059669" : "#D97706" }}>
                            {item.prepared ? "Prepared for checker" : "Awaiting review"}
                          </strong>
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                          {!item.prepared ? (
                            <button
                              className="btn-pill"
                              style={{ height: "30px", fontSize: "11px" }}
                              onClick={() => {
                                setPrepareCaseId(item.id);
                                setPrepareEvidenceNote("");
                              }}
                            >
                              Prepare Review
                            </button>
                          ) : (
                            <button
                              className="btn-pill primary"
                              style={{ height: "30px", fontSize: "11px" }}
                              onClick={() => setCloseCaseId(item.id)}
                            >
                              Check Verified Status
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Active Wallet Holds Table */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Active Wallet Ledger Holds</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Funds quarantined pending chargeback resolution or provider reconciliation
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--coral-bg)", color: "var(--coral-text)" }}>
                {data.activeHolds.length} Quarantined
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Transaction Reference</th>
                  <th>Amount Quarantined</th>
                  <th>Transaction Status</th>
                  <th style={{ textAlign: "right" }}>Hold Created</th>
                </tr>
              </thead>
              <tbody>
                {data.activeHolds.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                      No active holds matched this bounded review.
                    </td>
                  </tr>
                ) : (
                  data.activeHolds.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <span className="table-id-link">{h.reference}</span>
                      </td>
                      <td>
                        <span className="table-amount" style={{ color: "#DC2626" }}>
                          {money(h.amountMinor, h.currency)}
                        </span>
                      </td>
                      <td>
                        <span className="pill-badge" style={{ background: "var(--coral-bg)", color: "var(--coral-text)" }}>
                          {h.transactionStatus}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(h.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Prepare Review Modal */}
          {prepareCaseId && (
            <ModalDialog isOpen={!!prepareCaseId} onClose={() => setPrepareCaseId(null)}>
              <div className="modal-badge-row">
                <div className="modal-avatar-badge modal-badge-blue">📋</div>
                <div className="modal-title-wrap">
                  <h3>Record Factual Review Evidence</h3>
                  <p>Stage exception case for independent checker sign-off</p>
                </div>
                <button className="modal-close-btn" onClick={() => setPrepareCaseId(null)}>&times;</button>
              </div>

              <div className="ops-banner info" style={{ margin: 0, padding: "10px 14px", fontSize: "12px" }}>
                <span>🛡️</span>
                <div>
                  <strong>Data Minimization Rule:</strong> Do not record bank account numbers, customer PINs, or raw ciphertexts. Record strictly factual bank reference or settlement mismatch details.
                </div>
              </div>

              <div className="ops-form" style={{ gap: "6px" }}>
                <label>
                  <span style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Factual Review Evidence (min 20 characters)</span>
                    <span style={{ color: prepareEvidenceNote.trim().length >= 20 ? "#059669" : "#DC2626", fontWeight: 700, fontSize: "11px" }}>
                      {prepareEvidenceNote.trim().length} / 20 min chars
                    </span>
                  </span>
                  <textarea
                    rows={3}
                    className="pill-input"
                    style={{ borderRadius: "10px", height: "auto", padding: "10px" }}
                    placeholder="Document matching switch statement or clearing session mismatch..."
                    value={prepareEvidenceNote}
                    onChange={(e) => setPrepareEvidenceNote(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-footer-actions">
                <button className="btn-pill" onClick={() => setPrepareCaseId(null)}>Cancel</button>
                <button
                  className="btn-pill primary"
                  onClick={handleConfirmPrepare}
                  disabled={prepareEvidenceNote.trim().length < 20}
                >
                  Stage Evidence for Checker &rarr;
                </button>
              </div>
            </ModalDialog>
          )}

          {/* Close Case Modal */}
          {closeCaseId && (
            <ModalDialog isOpen={!!closeCaseId} onClose={() => setCloseCaseId(null)}>
              <div className="modal-badge-row">
                <div className="modal-avatar-badge modal-badge-green">✓</div>
                <div className="modal-title-wrap">
                  <h3>Close Verified Status Case</h3>
                  <p>Confirm verified terminal state</p>
                </div>
                <button className="modal-close-btn" onClick={() => setCloseCaseId(null)}>&times;</button>
              </div>

              <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E", margin: 0 }}>
                <span>⚠️</span>
                <div>
                  Only matched, terminal provider and ledger evidence can be closed. This does not release funds or rewrite ledger entries.
                </div>
              </div>

              <div className="modal-footer-actions">
                <button className="btn-pill" onClick={() => setCloseCaseId(null)}>Cancel</button>
                <button className="btn-pill primary" onClick={handleConfirmClose}>
                  Confirm Case Closure
                </button>
              </div>
            </ModalDialog>
          )}
        </>
      )}
    </OpsShell>
  );
}
