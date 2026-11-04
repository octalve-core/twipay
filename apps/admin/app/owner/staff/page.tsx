"use client";

import { FormEvent, useEffect, useState } from "react";
import { OpsShell } from "../../_components/ops-shell";
import { opsGet, opsMutation, explainCode } from "../../_lib/api";
import { InviteStaffModal, ApproveModal, RejectModal } from "../../_components/modals";

interface Review {
  id: string;
  targetUserId: string;
  roleCode: string;
  action: string;
  reason: string;
  preparedByUserId: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  emailMasked: string;
  roleCode: string;
  status: string;
  preparedByUserId: string;
  expiresAt: string;
}

interface Member {
  userId: string;
  emailMasked: string;
  role: string;
  status: string;
}

const roles = ["SUPPORT_AGENT", "AUDITOR", "COMPLIANCE"] as const;

export default function StaffGovernance() {
  const [staff, setStaff] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [rejectAction, setRejectAction] = useState<{ type: "review" | "invitation"; id: string; targetText: string } | null>(null);
  const [approveAction, setApproveAction] = useState<{ type: "review" | "invitation"; id: string; targetText: string } | null>(null);

  async function load() {
    try {
      const [s, r] = await Promise.all([
        opsGet<{ staff: Member[] }>("/operations/owner/staff"),
        opsGet<{ reviews: Review[] }>("/operations/owner/staff/reviews")
      ]);
      setStaff(s.staff);
      setReviews(r.reviews);
      const i = await opsGet<{ invitations: Invitation[] }>("/operations/owner/staff/invitations");
      setInvitations(i.invitations);
      setError("");
    } catch (e: any) {
      setError(explainCode(e.code, "REQUEST_FAILED"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMsg("");
    try {
      await opsMutation("/operations/owner/staff/reviews", {
        targetUserId: String(f.get("targetUserId")),
        roleCode: String(f.get("roleCode")),
        action: String(f.get("action")),
        reason: String(f.get("reason"))
      });
      setMsg("Proposal recorded. A different owner must approve it.");
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (e: any) {
      setMsg(explainCode(e.code, "ACTION_DENIED"));
    }
  }

  async function handleConfirmInvite(payload: { email: string; roleCode: string; reason: string }) {
    setMsg("");
    try {
      await opsMutation("/operations/owner/staff/invitations", payload);
      setMsg("Invitation staged. An independent owner must approve before the recipient can accept.");
      await load();
    } catch (e: any) {
      setMsg(explainCode(e.code, "INVITATION_DENIED"));
    }
  }

  async function handleConfirmApprove() {
    if (!approveAction) return;
    try {
      if (approveAction.type === "invitation") {
        await opsMutation(`/operations/owner/staff/invitations/${approveAction.id}/approve`, {});
        setMsg("Invitation approval recorded.");
      } else {
        await opsMutation(`/operations/owner/staff/reviews/${approveAction.id}/approve`, {});
        setMsg("Independent review approval recorded.");
      }
      setApproveAction(null);
      await load();
    } catch (e: any) {
      setMsg(explainCode(e.code, "ACTION_DENIED"));
    }
  }

  async function handleConfirmReject(reason: string) {
    if (!rejectAction) return;
    try {
      if (rejectAction.type === "invitation") {
        await opsMutation(`/operations/owner/staff/invitations/${rejectAction.id}/reject`, { reason });
        setMsg("Invitation rejection recorded.");
      } else {
        await opsMutation(`/operations/owner/staff/reviews/${rejectAction.id}/reject`, { reason });
        setMsg("Independent review rejection recorded.");
      }
      setRejectAction(null);
      await load();
    } catch (e: any) {
      setMsg(explainCode(e.code, "ACTION_DENIED"));
    }
  }

  async function revokeInvitation(id: string) {
    setRejectAction({ type: "invitation", id, targetText: "Invitation Revocation" });
  }

  return (
    <OpsShell
      title="Staff Governance &amp; Role Delegations"
      eyebrow="Dual-Control Access Management"
      actions={
        <button
          className="btn-pill primary"
          onClick={() => setShowInviteModal(true)}
        >
          + Invite Staff Member &rarr;
        </button>
      }
    >
      <div className="ops-banner" style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}>
        <span>👥</span>
        <div>
          <strong>Two-person control Invariant:</strong> Each change is proposed by one owner and checked by another with recent MFA. Only support, audit and compliance roles can be delegated. No owner/finance/provider role can be granted here.
        </div>
      </div>

      {msg && (
        <div className="ops-banner info" style={{ padding: "10px 14px", fontSize: "12px" }}>
          <span>ℹ️</span>
          <div>{msg}</div>
        </div>
      )}

      {error && (
        <div className="ops-banner danger">
          <span>🛑</span>
          <div>{error}</div>
        </div>
      )}

      {/* Two Column Layout: Access Proposal + Pending Approvals */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "24px" }}>
        {/* Prepare Access Change Form Card */}
        <div className="ops-panel">
          <h2>Prepare Access Role Change</h2>
          <form className="ops-form" onSubmit={prepare}>
            <label>
              Verified, Active Customer UUID
              <input
                name="targetUserId"
                required
                maxLength={36}
                pattern="[0-9a-fA-F\-]{36}"
                className="pill-input"
                placeholder="e4fd536b-22e5-4f2d-9a61-7c48113994c5"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <label>
                Role
                <select name="roleCode" className="pill-input">
                  {roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>

              <label>
                Action
                <select name="action" className="pill-input">
                  <option value="GRANT">Grant Limited Role</option>
                  <option value="REVOKE">Revoke Staff Role</option>
                </select>
              </label>
            </div>

            <label>
              Reason (20–500 characters)
              <input
                name="reason"
                required
                minLength={20}
                maxLength={500}
                className="pill-input"
                placeholder="Document operational requirement or change ticket ID..."
              />
            </label>

            <button type="submit" className="btn-pill primary" style={{ height: "40px" }}>
              Prepare for independent approval
            </button>
          </form>
        </div>

        {/* Pending Independent Approvals Table Card */}
        <div className="data-table-card">
          <div className="table-header-bar">
            <div>
              <h3>Pending Independent Owner Reviews</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Requires second owner confirmation
              </p>
            </div>
            <span className="pill-badge" style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
              {reviews.length} Staged
            </span>
          </div>

          <table className="ops-table">
            <thead>
              <tr>
                <th>Target Customer</th>
                <th>Role Code</th>
                <th>Action &amp; Maker</th>
                <th style={{ textAlign: "right" }}>Checker Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center" }}>Loading reviews…</td></tr>
              ) : reviews.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>No pending role change reviews.</td></tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="table-id-link">{r.targetUserId}</span>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {r.reason}
                      </span>
                    </td>
                    <td>
                      <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                        {r.roleCode}
                      </span>
                    </td>
                    <td>
                      <strong>{r.action}</strong>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                        Maker: {r.preparedByUserId}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                        <button
                          className="btn-pill primary"
                          style={{ height: "30px", fontSize: "11px" }}
                          onClick={() => setApproveAction({ type: "review", id: r.id, targetText: `${r.action} ${r.roleCode} for ${r.targetUserId}` })}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-pill danger"
                          style={{ height: "30px", fontSize: "11px" }}
                          onClick={() => setRejectAction({ type: "review", id: r.id, targetText: `Role change for ${r.targetUserId}` })}
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
      </div>

      {/* Staged Staff Invitations Table Card */}
      <div className="data-table-card">
        <div className="table-header-bar">
          <div>
            <h3>Pending &amp; Approved Staff Invitations</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Recipient must register, enable MFA and explicitly accept before credentials issue
            </p>
          </div>
          <span className="pill-badge" style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}>
            {invitations.length} Invitations
          </span>
        </div>

        <table className="ops-table">
          <thead>
            <tr>
              <th>Recipient Email</th>
              <th>Delegated Role</th>
              <th>Status State</th>
              <th style={{ textAlign: "right" }}>Invitation Action</th>
            </tr>
          </thead>
          <tbody>
            {invitations.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}>No invitations staged.</td></tr>
            ) : (
              invitations.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.emailMasked}</strong>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                      Expires: {new Date(i.expiresAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td>
                    <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                      {i.roleCode}
                    </span>
                  </td>
                  <td>
                    <span
                      className="pill-badge"
                      style={{
                        background: i.status === "APPROVED" ? "var(--green-bg)" : "var(--amber-bg)",
                        color: i.status === "APPROVED" ? "var(--green-text)" : "var(--amber-text)"
                      }}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="actions-inline" style={{ justifyContent: "flex-end" }}>
                      {i.status === "PREPARED" && (
                        <>
                          <button
                            className="btn-pill primary"
                            style={{ height: "30px", fontSize: "11px" }}
                            onClick={() => setApproveAction({ type: "invitation", id: i.id, targetText: `Invitation for ${i.emailMasked}` })}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-pill danger"
                            style={{ height: "30px", fontSize: "11px" }}
                            onClick={() => setRejectAction({ type: "invitation", id: i.id, targetText: `Invitation for ${i.emailMasked}` })}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {i.status === "APPROVED" && (
                        <button
                          className="btn-pill danger"
                          style={{ height: "30px", fontSize: "11px" }}
                          onClick={() => revokeInvitation(i.id)}
                        >
                          Revoke
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

      {/* Current Active Staff Directory Table Card */}
      <div className="data-table-card">
        <div className="table-header-bar">
          <div>
            <h3>Current Bounded Staff &amp; Owners</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Active accounts with operational least-privilege role bounds
            </p>
          </div>
          <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
            {staff.length} Active Operators
          </span>
        </div>

        <table className="ops-table">
          <thead>
            <tr>
              <th>Masked Email</th>
              <th>Assigned Role</th>
              <th>Account Status</th>
              <th style={{ textAlign: "right" }}>Customer UUID</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={`${s.userId}:${s.role}`}>
                <td><strong>{s.emailMasked}</strong></td>
                <td>
                  <span className="pill-badge" style={{ background: "var(--surface-muted)", color: "var(--text-main)" }}>
                    {s.role}
                  </span>
                </td>
                <td>
                  <span className="pill-badge" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="table-id-link" style={{ fontSize: "11px" }}>{s.userId}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Staff Modal */}
      {showInviteModal && (
        <InviteStaffModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onConfirm={handleConfirmInvite}
        />
      )}

      {/* Dual Control Approve Modal */}
      {approveAction && (
        <ApproveModal
          isOpen={!!approveAction}
          onClose={() => setApproveAction(null)}
          onConfirm={handleConfirmApprove}
          title="Approve Staff Governance Action"
          reference={approveAction.targetText}
          amountText="Role Delegation"
          beneficiaryText={approveAction.targetText}
          makerText="Executive Owner Sign-off"
          railText="Internal Quorum Governance"
        />
      )}

      {/* Reject Modal */}
      {rejectAction && (
        <RejectModal
          isOpen={!!rejectAction}
          onClose={() => setRejectAction(null)}
          onConfirm={handleConfirmReject}
          title="Reject Staff Governance Proposal"
          reference={rejectAction.targetText}
          minChars={20}
        />
      )}
    </OpsShell>
  );
}
