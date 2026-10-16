"use client";

import { FormEvent, useEffect, useState } from "react";
import { OpsShell } from "../../_components/ops-shell";
import { Fail, Wait } from "../../_components/state";
import { opsGet, opsMutation } from "../../_lib/api";
import { ApproveModal, RejectModal } from "../../_components/modals";

interface Suspension {
  id: string;
  targetUserId: string;
  reason: string;
  preparedByUserId: string;
  createdAt: string;
}

interface Activity {
  userId: string;
  status: string;
  period: { from: string; to: string };
  transactions: { type: string; status: string; count: number }[];
  supportCases: { status: string; count: number }[];
  eventOrders: { status: string; count: number }[];
  securityEventCount: number;
  recentTransactions: { id: string; type: string; status: string; createdAt: string }[];
  recentSupport: { reference: string; status: string; createdAt: string }[];
}

interface Customer {
  id: string;
  emailMasked: string;
  status: string;
  contactVerified: boolean;
  createdAt: string;
  financialEligibility: string;
  kycTier: number;
}

export default function OwnerCustomers() {
  const [activity, setActivity] = useState<Activity>();
  const [activityError, setActivityError] = useState("");
  const [data, setData] = useState<Customer[]>();
  const [reviews, setReviews] = useState<Suspension[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [approveSuspensionTarget, setApproveSuspensionTarget] = useState<Suspension | null>(null);
  const [rejectSuspensionTarget, setRejectSuspensionTarget] = useState<Suspension | null>(null);

  async function load(query = "") {
    try {
      const d = await opsGet<{ customers: Customer[] }>(
        `/operations/owner/customers${query ? `?search=${encodeURIComponent(query)}` : ""}`
      );
      setData(d.customers);
      setError("");
    } catch (e: any) {
      setError(e.code || "REQUEST_FAILED");
    }
  }

  async function loadReviews() {
    try {
      setReviews((await opsGet<{ reviews: Suspension[] }>("/operations/owner/customers/suspensions")).reviews);
    } catch (e: any) {
      setError(e.code || "REQUEST_FAILED");
    }
  }

  useEffect(() => {
    void load();
    void loadReviews();
  }, []);

  async function showActivity(id: string) {
    setActivity(undefined);
    setActivityError("");
    try {
      setActivity(await opsGet<Activity>(`/operations/owner/customers/${encodeURIComponent(id)}/activity`));
    } catch (e: any) {
      setActivityError(e.code || "ACTIVITY_UNAVAILABLE");
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void load(search.trim());
  }

  async function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await opsMutation("/operations/owner/customers/suspensions", {
        targetUserId: String(f.get("targetUserId")),
        reason: String(f.get("reason"))
      });
      setMessage("Suspension proposal recorded. A different owner must approve it.");
      (e.target as HTMLFormElement).reset();
      await loadReviews();
    } catch (err: any) {
      setMessage(err.code || "ACTION_DENIED");
    }
  }

  async function handleConfirmApprove() {
    if (!approveSuspensionTarget) return;
    try {
      await opsMutation(`/operations/owner/customers/suspensions/${approveSuspensionTarget.id}/approve`, {});
      setMessage(`Customer account restriction confirmed.`);
      setApproveSuspensionTarget(null);
      await loadReviews();
      await load(search.trim());
    } catch (err: any) {
      setMessage(err.code || "ACTION_DENIED");
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!rejectSuspensionTarget) return;
    try {
      await opsMutation(`/operations/owner/customers/suspensions/${rejectSuspensionTarget.id}/reject`, { reason });
      setMessage(`Suspension proposal rejected.`);
      setRejectSuspensionTarget(null);
      await loadReviews();
    } catch (err: any) {
      setMessage(err.code || "ACTION_DENIED");
    }
  }

  return (
    <OpsShell
      title="Customer Oversight &amp; Account Master-Detail"
      eyebrow="Portfolio Governance &amp; Risk Review"
    >
      <div className="ops-banner info">
        <span>🏢</span>
        <div>
          <strong>Privacy first Invariant:</strong> Bounded 40-record snapshot or exact email/UUID lookup. Contact details are masked. This page cannot view raw identity documents, change limits or move funds.
        </div>
      </div>

      {message && (
        <div className="ops-banner" style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}>
          <span>ℹ️</span>
          <div>{message}</div>
        </div>
      )}

      {/* Two Column Grid: Search & Suspend Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Search Customer Card */}
        <div className="ops-panel">
          <h2>Find Customer Record</h2>
          <form className="ops-form" onSubmit={submit}>
            <label>
              Exact Email or Customer UUID
              <input
                value={search}
                maxLength={320}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. merchant@twipay.com or UUID"
                className="pill-input"
              />
            </label>
            <div className="actions-inline">
              <button type="submit" className="btn-pill primary" style={{ height: "36px" }}>
                Search Securely
              </button>
              <button
                type="button"
                className="btn-pill"
                style={{ height: "36px" }}
                onClick={() => {
                  setSearch("");
                  void load();
                }}
              >
                Reset to Latest 40
              </button>
            </div>
          </form>
        </div>

        {/* Account Restriction Form */}
        <div className="ops-panel">
          <h2>Prepare Account Restriction / Freeze</h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
            High-impact risk restriction requiring independent owner quorum approval.
          </p>
          <form className="ops-form" onSubmit={prepare}>
            <label>
              Target Customer UUID
              <input
                name="targetUserId"
                required
                maxLength={36}
                pattern="[0-9a-fA-F-]{36}"
                className="pill-input"
                placeholder="e4fd536b-22e5-4f2d-9a61-7c48113994c5"
              />
            </label>
            <label>
              Reason &amp; Evidence Summary (20–500 chars)
              <input
                name="reason"
                minLength={20}
                maxLength={500}
                required
                className="pill-input"
                placeholder="Detail suspicious activity, AML flag, or court order..."
              />
            </label>
            <button type="submit" className="btn-pill danger" style={{ height: "38px" }}>
              Prepare Suspension for Checker &rarr;
            </button>
          </form>
        </div>
      </div>

      {/* Pending Customer Suspensions Table Card */}
      <div className="data-table-card">
        <div className="table-header-bar">
          <div>
            <h3>Pending Customer Suspensions &amp; Holds</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Requires second owner review before restriction takes effect
            </p>
          </div>
          <span className="pill-badge" style={{ background: "var(--coral-bg)", color: "var(--coral-text)" }}>
            {reviews.length} Staged
          </span>
        </div>

        <table className="ops-table">
          <thead>
            <tr>
              <th>Target Customer UUID</th>
              <th>Proposing Maker</th>
              <th>Documented Evidence</th>
              <th style={{ textAlign: "right" }}>Checker Action</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>No pending suspension proposals.</td></tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id}>
                  <td><span className="table-id-link">{r.targetUserId}</span></td>
                  <td>{r.preparedByUserId}</td>
                  <td>{r.reason}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="btn-pill primary"
                        style={{ height: "30px", fontSize: "11px" }}
                        onClick={() => setApproveSuspensionTarget(r)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-pill danger"
                        style={{ height: "30px", fontSize: "11px" }}
                        onClick={() => setRejectSuspensionTarget(r)}
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
      </div>

      {/* Customer Master Directory Card */}
      <div className="data-table-card">
        <div className="table-header-bar">
          <div>
            <h3>Customer Directory ({data?.length || 0} Records)</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Masked identifiers, verification standing, and financial KYC tiers
            </p>
          </div>
          <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
            Verified Ledger
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
                <th>Customer Entity &amp; Masked Email</th>
                <th>Account Status</th>
                <th>Contact Verification</th>
                <th>Financial Eligibility</th>
                <th style={{ textAlign: "right" }}>Activity Inspection</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.emailMasked}</strong>
                    <span className="table-id-link" style={{ display: "block", fontSize: "11px", marginTop: "2px" }}>
                      {c.id}
                    </span>
                  </td>
                  <td>
                    <span
                      className="pill-badge"
                      style={{
                        background: c.status === "ACTIVE" ? "var(--green-bg)" : "var(--coral-bg)",
                        color: c.status === "ACTIVE" ? "var(--green-text)" : "var(--coral-text)"
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className="pill-badge"
                      style={{
                        background: c.contactVerified ? "var(--green-bg)" : "var(--amber-bg)",
                        color: c.contactVerified ? "var(--green-text)" : "var(--amber-text)"
                      }}
                    >
                      {c.contactVerified ? "✓ Verified" : "Unverified"}
                    </span>
                  </td>
                  <td>
                    <strong>{c.financialEligibility}</strong>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                      Tier {c.kycTier} &bull; {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn-pill"
                      style={{ height: "30px", fontSize: "11px" }}
                      onClick={() => void showActivity(c.id)}
                    >
                      View aggregate activity
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Customer Activity Detail Card */}
      {activity && (
        <div className="ops-panel">
          <h2>Observed Activity &bull; {activity.userId}</h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
            {new Date(activity.period.from).toLocaleDateString()} to {new Date(activity.period.to).toLocaleDateString()} &bull; Standing: {activity.status}. Zero raw PII or ciphertexts.
          </p>

          <div className="metrics-grid-4" style={{ marginBottom: "16px" }}>
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Transactions</span>
                <span className="metric-value">
                  {activity.transactions.reduce((acc, t) => acc + t.count, 0)}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Support Inquiries</span>
                <span className="metric-value">
                  {activity.supportCases.reduce((acc, s) => acc + s.count, 0)}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Event Orders</span>
                <span className="metric-value">
                  {activity.eventOrders.reduce((acc, o) => acc + o.count, 0)}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-data">
                <span className="metric-label">Security Incidents</span>
                <span className="metric-value">{activity.securityEventCount}</span>
              </div>
            </div>
          </div>

          <div className="data-table-card">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Recent Transaction UUID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {activity.recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td><span className="table-id-link">{tx.id}</span></td>
                    <td>{tx.type}</td>
                    <td>{tx.status}</td>
                    <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Suspension Modal */}
      {approveSuspensionTarget && (
        <ApproveModal
          isOpen={!!approveSuspensionTarget}
          onClose={() => setApproveSuspensionTarget(null)}
          onConfirm={handleConfirmApprove}
          title="Authorize Customer Account Restriction"
          reference={approveSuspensionTarget.targetUserId}
          amountText="Account Restriction"
          beneficiaryText={`Customer ${approveSuspensionTarget.targetUserId}`}
          makerText={`Maker: ${approveSuspensionTarget.preparedByUserId}`}
          railText={`Reason: ${approveSuspensionTarget.reason}`}
        />
      )}

      {/* Reject Suspension Modal */}
      {rejectSuspensionTarget && (
        <RejectModal
          isOpen={!!rejectSuspensionTarget}
          onClose={() => setRejectSuspensionTarget(null)}
          onConfirm={handleConfirmReject}
          title="Reject Suspension Proposal"
          reference={rejectSuspensionTarget.targetUserId}
          minChars={20}
        />
      )}
    </OpsShell>
  );
}
