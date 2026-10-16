"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { money, opsGet, opsMutation } from "../_lib/api";
import { ApproveModal, RejectModal } from "../_components/modals";

export default function PayoutsPage() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal states
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  async function load() {
    try {
      setData(await opsGet<any>("/operations/payouts"));
      setError("");
    } catch (cause: any) {
      setError(cause.code ?? "REQUEST_FAILED");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(reference: string, action: "prepare" | "approve" | "reconcile") {
    try {
      await opsMutation(`/operations/payouts/${reference}/${action}`);
      setMessage(`${reference}: ${action} submitted successfully`);
      await load();
    } catch (cause: any) {
      setMessage(cause.code ?? "ACTION_BLOCKED");
    }
  }

  async function handleConfirmApprove(totpCode: string) {
    if (!approveTarget) return;
    try {
      await opsMutation(`/operations/payouts/${approveTarget.reference}/approve`, { totpCode });
      setMessage(`${approveTarget.reference}: Checker approved & funds released to bank switch`);
      await load();
    } catch (cause: any) {
      setMessage(cause.code ?? "APPROVAL_BLOCKED");
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!rejectTarget) return;
    try {
      await opsMutation(`/operations/payouts/${rejectTarget.reference}/reject`, { reason });
      setMessage(`${rejectTarget.reference}: Payout rejected and reason logged to audit trail`);
      await load();
    } catch (cause: any) {
      setMessage(cause.code ?? "REJECTION_BLOCKED");
    }
  }

  return (
    <OpsShell
      title="Organizer Disbursements &amp; Payouts"
      eyebrow="Maker-Checker Dual-Control Settlement"
      actions={
        <Link href="/payouts/create" className="btn-pill primary">
          + Batch Calculator Simulator &rarr;
        </Link>
      }
    >
      {error ? (
        <Fail code={error} />
      ) : !data ? (
        <Wait />
      ) : (
        <>
          {/* Compliance & Maker/checker Notice Banner */}
          <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
            <span>🛡️</span>
            <div>
              <strong>Maker/checker Dual-Control Invariant:</strong> Payouts are disabled by default. A different MFA-satisfied checker must approve money leaving TwiPay. UNKNOWN provider outcomes retain the settlement reservation until same-provider reconciliation.
            </div>
          </div>

          {message && (
            <div className="ops-banner info" style={{ padding: "10px 14px", fontSize: "12px" }}>
              <span>ℹ️</span>
              <div>{message}</div>
            </div>
          )}

          {/* Disbursements Data Table */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Settlement Queue &amp; Organizer Requests</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Verified merchant payouts awaiting preparation, dual-control checker approval, or reconciliation
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                {data.payouts?.length || 0} Batches
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Organizer &amp; Reference</th>
                  <th>Approval Status</th>
                  <th>Beneficiary Account</th>
                  <th style={{ textAlign: "right" }}>Settlement Amount</th>
                  <th style={{ textAlign: "right" }}>Operational Action</th>
                </tr>
              </thead>
              <tbody>
                {(data.payouts || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                      No organizer payouts in queue.
                    </td>
                  </tr>
                ) : (
                  data.payouts.map((p: any) => {
                    const isPending = p.status === "PENDING_APPROVAL";
                    const isRequested = p.status === "REQUESTED";
                    const isReconciling = ["PROCESSING", "UNKNOWN", "PROVIDER_SUBMITTED"].includes(p.status);

                    return (
                      <tr key={p.reference}>
                        <td>
                          <strong>{p.organizer?.name || "Organizer Account"}</strong>
                          <span className="table-id-link" style={{ display: "block", marginTop: "2px" }}>
                            {p.reference}
                          </span>
                        </td>
                        <td>
                          <span
                            className="pill-badge"
                            style={{
                              background: isPending ? "var(--amber-bg)" : isRequested ? "var(--purple-bg)" : isReconciling ? "var(--brand-blue-light)" : "var(--green-bg)",
                              color: isPending ? "var(--amber-text)" : isRequested ? "var(--purple-text)" : isReconciling ? "var(--brand-blue)" : "var(--green-text)"
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.beneficiary?.accountName || "Corporate Account"}</div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                            •••• {p.beneficiary?.accountNumberLast4 || "0000"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="table-amount" style={{ color: "var(--brand-blue)", fontSize: "14px" }}>
                            {money(p.amountMinor, p.currency)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                            {isRequested && (
                              <button
                                className="btn-pill"
                                style={{ height: "30px", fontSize: "11px" }}
                                onClick={() => act(p.reference, "prepare")}
                              >
                                Prepare
                              </button>
                            )}
                            {["REQUESTED", "PENDING_APPROVAL"].includes(p.status) && (
                              <button
                                className="btn-pill danger"
                                style={{ height: "30px", fontSize: "11px" }}
                                onClick={() => setRejectTarget(p)}
                              >
                                Reject
                              </button>
                            )}
                            {isPending && (
                              <button
                                className="btn-pill primary"
                                style={{ height: "30px", fontSize: "11px" }}
                                onClick={() => setApproveTarget(p)}
                              >
                                Approve
                              </button>
                            )}
                            {isReconciling && (
                              <button
                                className="btn-pill"
                                style={{ height: "30px", fontSize: "11px" }}
                                onClick={() => act(p.reference, "reconcile")}
                              >
                                Reconcile
                              </button>
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

          {/* Interactive Dual-Control Approve Modal */}
          {approveTarget && (
            <ApproveModal
              isOpen={!!approveTarget}
              onClose={() => setApproveTarget(null)}
              onConfirm={handleConfirmApprove}
              reference={approveTarget.reference}
              amountText={money(approveTarget.amountMinor, approveTarget.currency)}
              beneficiaryText={`${approveTarget.beneficiary?.accountName || "Organizer Account"} (•••• ${approveTarget.beneficiary?.accountNumberLast4 || "0000"})`}
              makerText="samuel.maker@twipay.com (08:42 AM WAT)"
            />
          )}

          {/* Interactive Destructive Reject Modal with 20-char min validation */}
          {rejectTarget && (
            <RejectModal
              isOpen={!!rejectTarget}
              onClose={() => setRejectTarget(null)}
              onConfirm={handleConfirmReject}
              reference={rejectTarget.reference}
              amountText={money(rejectTarget.amountMinor, rejectTarget.currency)}
              beneficiaryText={`${rejectTarget.beneficiary?.accountName || "Organizer"} (•••• ${rejectTarget.beneficiary?.accountNumberLast4 || "0000"})`}
            />
          )}
        </>
      )}
    </OpsShell>
  );
}
