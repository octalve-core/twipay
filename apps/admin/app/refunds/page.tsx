"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { money, opsGet, opsMutation, explainCode } from "../_lib/api";
import { ApproveModal, RejectModal } from "../_components/modals";

export default function RefundsPage() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [prepareTarget, setPrepareTarget] = useState<any>(null);
  const [prepareNote, setPrepareNote] = useState("");

  async function load() {
    try {
      setData(await opsGet<any>("/operations/refunds"));
      setError("");
    } catch (cause: any) {
      setError(explainCode(cause.code, "REQUEST_FAILED"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleConfirmPrepare() {
    if (!prepareTarget || prepareNote.trim().length < 5) return;
    try {
      await opsMutation(`/operations/refunds/${prepareTarget.reference}/prepare`, { note: prepareNote.trim() });
      setMessage(`${prepareTarget.reference}: Prepared for independent checker approval`);
      setPrepareTarget(null);
      setPrepareNote("");
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "PREPARE_BLOCKED"));
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!rejectTarget) return;
    try {
      await opsMutation(`/operations/refunds/${rejectTarget.reference}/reject`, { reason });
      setMessage(`${rejectTarget.reference}: Refund rejected and reversal logged`);
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "REJECTION_BLOCKED"));
    }
  }

  async function handleConfirmApprove() {
    if (!approveTarget) return;
    try {
      await opsMutation(`/operations/refunds/${approveTarget.reference}/approve`);
      setMessage(`${approveTarget.reference}: Compensating journal posted and refund dispatched`);
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "APPROVAL_BLOCKED"));
    }
  }

  return (
    <OpsShell
      title="Refunds, Disputes &amp; Ledger Reversals"
      eyebrow="Immutable Compensating Journals"
    >
      {error ? (
        <Fail code={error} />
      ) : !data ? (
        <Wait />
      ) : (
        <>
          {/* Fail closed operational notice */}
          <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
            <span>⚠️</span>
            <div>
              <strong>Fail closed Invariant:</strong> Event refunds are disabled by default. When enabled, approval still requires a different checker with recent MFA and posts a compensating journal; the original purchase journal is never edited.
            </div>
          </div>

          {message && (
            <div className="ops-banner info" style={{ padding: "10px 14px", fontSize: "12px" }}>
              <span>ℹ️</span>
              <div>{message}</div>
            </div>
          )}

          {/* Refunds & Disputes Table */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Customer Dispute Requests &amp; Chargeback Claims</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  All refunds require independent checker authorization and post compensating double-entry journals
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}>
                {data.refunds?.length || 0} Open Cases
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Refund Reference</th>
                  <th>Dispute Status</th>
                  <th style={{ textAlign: "right" }}>Reversal Amount</th>
                  <th style={{ textAlign: "right" }}>Operational Action</th>
                </tr>
              </thead>
              <tbody>
                {(data.refunds || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                      No active refund requests in review.
                    </td>
                  </tr>
                ) : (
                  data.refunds.map((refund: any) => {
                    const isRequested = refund.status === "REQUESTED";
                    const isReview = refund.status === "UNDER_REVIEW";

                    return (
                      <tr key={refund.reference}>
                        <td>
                          <span className="table-id-link">{refund.reference}</span>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            Original ticket purchase transaction
                          </span>
                        </td>
                        <td>
                          <span
                            className="pill-badge"
                            style={{
                              background: isRequested ? "var(--amber-bg)" : isReview ? "var(--purple-bg)" : "var(--green-bg)",
                              color: isRequested ? "var(--amber-text)" : isReview ? "var(--purple-text)" : "var(--green-text)"
                            }}
                          >
                            {refund.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="table-amount" style={{ color: "var(--brand-blue)" }}>
                            {money(refund.amountMinor, refund.currency)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                            {isRequested && (
                              <>
                                <button
                                  className="btn-pill"
                                  style={{ height: "30px", fontSize: "11px" }}
                                  onClick={() => setPrepareTarget(refund)}
                                >
                                  Prepare Review
                                </button>
                                <button
                                  className="btn-pill danger"
                                  style={{ height: "30px", fontSize: "11px" }}
                                  onClick={() => setRejectTarget(refund)}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {isReview && (
                              <>
                                <button
                                  className="btn-pill primary"
                                  style={{ height: "30px", fontSize: "11px" }}
                                  onClick={() => setApproveTarget(refund)}
                                >
                                  Approve (Compensating Journal)
                                </button>
                                <button
                                  className="btn-pill danger"
                                  style={{ height: "30px", fontSize: "11px" }}
                                  onClick={() => setRejectTarget(refund)}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Prepare Note Dialog */}
          {prepareTarget && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-badge-row">
                  <div className="modal-avatar-badge modal-badge-blue">📝</div>
                  <div className="modal-title-wrap">
                    <h3>Prepare Refund Review</h3>
                    <p>Stage reference {prepareTarget.reference} for independent checker approval</p>
                  </div>
                  <button className="modal-close-btn" onClick={() => setPrepareTarget(null)}>&times;</button>
                </div>

                <div className="ops-form" style={{ gap: "6px" }}>
                  <label>
                    Review Note for Checker (min 5 characters)
                    <input
                      type="text"
                      className="pill-input"
                      placeholder="e.g. Organizer approved refund due to event postponement"
                      value={prepareNote}
                      onChange={(e) => setPrepareNote(e.target.value)}
                    />
                  </label>
                </div>

                <div className="modal-footer-actions">
                  <button className="btn-pill" onClick={() => setPrepareTarget(null)}>Cancel</button>
                  <button
                    className="btn-pill primary"
                    onClick={handleConfirmPrepare}
                    disabled={prepareNote.trim().length < 5}
                  >
                    Submit for Checker &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dual-Control Approve Modal */}
          {approveTarget && (
            <ApproveModal
              isOpen={!!approveTarget}
              onClose={() => setApproveTarget(null)}
              onConfirm={handleConfirmApprove}
              title="Authorize Compensating Refund"
              reference={approveTarget.reference}
              amountText={money(approveTarget.amountMinor, approveTarget.currency)}
              beneficiaryText="Ticket Buyer Account"
              makerText="support.agent@twipay.com"
              railText="Original Payment Provider Inversion"
            />
          )}

          {/* Reject Modal with 20-char validation */}
          {rejectTarget && (
            <RejectModal
              isOpen={!!rejectTarget}
              onClose={() => setRejectTarget(null)}
              onConfirm={handleConfirmReject}
              title="Reject Refund Claim"
              reference={rejectTarget.reference}
              amountText={money(rejectTarget.amountMinor, rejectTarget.currency)}
              beneficiaryText="Ticket Buyer"
            />
          )}
        </>
      )}
    </OpsShell>
  );
}
