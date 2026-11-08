"use client";

import { useEffect, useState, type FormEvent } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { money, opsGet, opsMutation, explainCode } from "../_lib/api";
import { ApproveModal, RejectModal } from "../_components/modals";

type Review = {
  id: string;
  userId: string;
  status: string;
  proposedTier: number;
  maxPerIntentMinor: string;
  maxDailyDebitMinor: string;
  evidenceReference: string;
  preparedByUserId: string;
  createdAt: string;
};

export default function FinancialTierPage() {
  const [data, setData] = useState<{ reviews: Review[]; bounded: boolean }>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [approveTarget, setApproveTarget] = useState<Review | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Review | null>(null);

  async function refresh() {
    try {
      setData(await opsGet("/operations/financial-eligibility/reviews"));
      setError("");
    } catch (e: any) {
      setError(explainCode(e.code, "REQUEST_FAILED"));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      tier: Number(form.get("tier")),
      maxPerIntentMinor: String(form.get("maxPerIntentMinor")),
      maxDailyDebitMinor: String(form.get("maxDailyDebitMinor")),
      evidenceReference: String(form.get("evidenceReference")),
      note: String(form.get("note"))
    };
    const userId = String(form.get("userId"));

    try {
      await opsMutation(`/operations/financial-eligibility/${encodeURIComponent(userId)}/prepare`, body);
      setMessage("Review prepared. Another authorized person must independently approve it.");
      (event.target as HTMLFormElement).reset();
      await refresh();
    } catch (e: any) {
      setMessage(explainCode(e.code, "PREPARATION_BLOCKED"));
    }
  }

  async function handleConfirmApprove() {
    if (!approveTarget) return;
    try {
      await opsMutation(`/operations/financial-eligibility/reviews/${approveTarget.id}/approve`, {});
      setMessage("Tier approval recorded (financial features stay disabled).");
      await refresh();
    } catch (e: any) {
      setMessage(explainCode(e.code, "INDEPENDENT_REVIEW_BLOCKED"));
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!rejectTarget) return;
    try {
      await opsMutation(`/operations/financial-eligibility/reviews/${rejectTarget.id}/reject`, { reason });
      setMessage("Tier upgrade review rejected.");
      await refresh();
    } catch (e: any) {
      setMessage(explainCode(e.code, "INDEPENDENT_REVIEW_BLOCKED"));
    }
  }

  return (
    <OpsShell
      title="Financial Tiers &amp; Caps Governance"
      eyebrow="Dual-Review Compliance Controls"
    >
      <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
        <span>🛡️</span>
        <div>
          <strong>Default-deny controls:</strong> Financial tiers require verified contact, current BVN evidence, enrolled MFA, separately configured policy caps and two different authorized reviewers. This screen never enables transfers or provider flags.
        </div>
      </div>

      {message && (
        <div className="ops-banner info" style={{ padding: "10px 14px", fontSize: "12px" }}>
          <span>ℹ️</span>
          <div>{message}</div>
        </div>
      )}

      {/* Two Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "24px" }}>
        {/* Prepare Review Card */}
        <div className="ops-panel">
          <h2>Prepare Independent Tier Review</h2>
          <form onSubmit={prepare} className="ops-form">
            <label>
              Customer UUID
              <input
                name="userId"
                type="text"
                required
                className="pill-input"
                pattern="[0-9a-fA-F\-]{36}"
                placeholder="e4fd536b-22e5-4f2d-9a61-7c48113994c5"
              />
            </label>

            <label>
              Proposed Financial Tier
              <select name="tier" className="pill-input">
                <option value="1">Tier 1 (Unverified Contact • ₦50K Intent)</option>
                <option value="2">Tier 2 (Verified Contact + BVN • ₦100K Intent)</option>
                <option value="3">Tier 3 (Corporate CAC + High Cap)</option>
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label>
                Max Per Intent (Minor NGN)
                <input
                  name="maxPerIntentMinor"
                  type="text"
                  required
                  pattern="[1-9][0-9]*"
                  className="pill-input"
                  placeholder="10000000"
                />
              </label>

              <label>
                Max Daily Debit (Minor NGN)
                <input
                  name="maxDailyDebitMinor"
                  type="text"
                  required
                  pattern="[1-9][0-9]*"
                  className="pill-input"
                  placeholder="50000000"
                />
              </label>
            </div>

            <label>
              Verified BVN Check Evidence ID (UUID)
              <input
                name="evidenceReference"
                required
                pattern="[0-9a-fA-F\-]{36}"
                className="pill-input"
                placeholder="b182f091-a182-4112-9c12-718291001291"
              />
            </label>

            <label>
              Risk and KYC Decision Note (min 30 chars)
              <textarea
                name="note"
                minLength={30}
                maxLength={1000}
                required
                rows={3}
                className="pill-input"
                style={{ borderRadius: "10px", height: "auto", padding: "10px" }}
                placeholder="Detail verification match against corporate documentation and identity registry..."
              />
            </label>

            <button type="submit" className="btn-pill primary" style={{ height: "40px", marginTop: "4px" }}>
              Submit Review for Checker &rarr;
            </button>
          </form>
        </div>

        {/* Pending Reviews Card */}
        <div className="data-table-card">
          <div className="table-header-bar">
            <div>
              <h3>Pending Tier Authorizations</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Awaiting independent checker confirmation
              </p>
            </div>
            <span className="pill-badge" style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}>
              {data?.reviews?.length || 0} Pending
            </span>
          </div>

          {error ? (
            <Fail code={error} />
          ) : !data ? (
            <Wait />
          ) : (
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Customer UUID</th>
                  <th>Proposed Limits</th>
                  <th>Maker / Evidence</th>
                  <th style={{ textAlign: "right" }}>Checker Action</th>
                </tr>
              </thead>
              <tbody>
                {data.reviews.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                      No pending tier reviews in queue.
                    </td>
                  </tr>
                ) : (
                  data.reviews.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="table-id-link">{r.userId}</span>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <strong>Tier {r.proposedTier}</strong>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--brand-blue)" }}>
                          {money(r.maxPerIntentMinor)} / intent
                        </span>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                          {money(r.maxDailyDebitMinor)} daily cap
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                          {r.evidenceReference.slice(0, 14)}...
                        </span>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                          Maker: {r.preparedByUserId}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                          <button
                            className="btn-pill primary"
                            style={{ height: "30px", fontSize: "11px" }}
                            onClick={() => setApproveTarget(r)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-pill danger"
                            style={{ height: "30px", fontSize: "11px" }}
                            onClick={() => setRejectTarget(r)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Dual Control Approve Modal */}
      {approveTarget && (
        <ApproveModal
          isOpen={!!approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={handleConfirmApprove}
          title={`Approve Tier ${approveTarget.proposedTier} Upgrade`}
          reference={approveTarget.userId}
          amountText={`${money(approveTarget.maxPerIntentMinor)} per intent`}
          beneficiaryText={`Customer ${approveTarget.userId}`}
          makerText={`Maker: ${approveTarget.preparedByUserId}`}
          railText={`Evidence: ${approveTarget.evidenceReference}`}
        />
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          isOpen={!!rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleConfirmReject}
          title="Reject Financial Tier Upgrade"
          reference={rejectTarget.userId}
          amountText={`Tier ${rejectTarget.proposedTier} (${money(rejectTarget.maxPerIntentMinor)})`}
          beneficiaryText={rejectTarget.userId}
          minChars={5}
        />
      )}
    </OpsShell>
  );
}
