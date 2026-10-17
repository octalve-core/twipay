"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail } from "../_components/state";
import { opsGet, opsMutation } from "../_lib/api";

type Summary = {
  reference: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
type DisputeSummary = {
  reference: string;
  status: string;
  category: string;
  reasonCode: string;
  openedAt: string;
};
type Detail = Summary & {
  messages: { id: string; authorType: string; text: string; createdAt: string }[];
};

/** No message bodies, document attachments, or credentials are stored in localStorage. */
export default function SupportOperationsPage() {
  const [disputes, setDisputes] = useState<DisputeSummary[]>([]);
  const [disputesUnavailable, setDisputesUnavailable] = useState(false);
  const [items, setItems] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");
  const requestKey = useRef<string | null>(null);
  const locked = useRef(false);

  async function load() {
    try {
      const res = await opsGet<{ cases: Summary[] }>("/operations/support/cases");
      setItems(res.cases);
      setError("");
    } catch (cause: any) {
      setError(cause.code ?? "REQUEST_FAILED");
    }
  }

  useEffect(() => {
    void load();
    void opsGet<{ disputes: DisputeSummary[] }>("/operations/disputes")
      .then((v) => setDisputes(v.disputes))
      .catch(() => setDisputesUnavailable(true));

    const timer = setInterval(() => {
      void load();
      void opsGet<{ disputes: DisputeSummary[] }>("/operations/disputes")
        .then((v) => setDisputes(v.disputes))
        .catch(() => setDisputesUnavailable(true));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const ref = selected.reference;
    const timer = setInterval(() => {
      void opsGet<{ case: Detail }>(`/operations/support/cases/${ref}`)
        .then((res) => setSelected(res.case))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [selected?.reference]);

  async function select(reference: string) {
    setSelected(null);
    setNotice("");
    setReply("");
    requestKey.current = null;
    try {
      const result = await opsGet<{ case: Detail }>(`/operations/support/cases/${reference}`);
      setSelected(result.case);
    } catch (cause: any) {
      setNotice(cause.code ?? "ACCESS_DENIED");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected || locked.current) return;
    locked.current = true;
    setBusy(true);
    setNotice("");
    requestKey.current ??= crypto.randomUUID();
    try {
      await opsMutation(`/operations/support/cases/${selected.reference}/replies`, {
        message: reply.trim(),
        requestKey: requestKey.current,
      });
      requestKey.current = null;
      setReply("");
      setNotice("Reply saved. The customer may receive a separate delivery notification.");
      await select(selected.reference);
      await load();
    } catch (cause: any) {
      setNotice(cause.code ?? "REPLY_NOT_CONFIRMED");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function close() {
    if (!selected || locked.current) return;
    locked.current = true;
    setBusy(true);
    setNotice("");
    try {
      await opsMutation(`/operations/support/cases/${selected.reference}/close`);
      setNotice("Case closed.");
      await load();
      setSelected(null);
    } catch (cause: any) {
      setNotice(cause.code ?? "CLOSE_BLOCKED");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <OpsShell
      title="Customer Support Operations &amp; Inquiries"
      eyebrow="Restricted Customer Assistance"
    >
      <div
        className="ops-banner"
        style={{ background: "#FEF9EE", borderColor: "#FDE68A", color: "#92400E" }}
      >
        <span>🎧</span>
        <div>
          <strong>Restricted customer information Invariant:</strong> Only authorized staff with
          recent MFA may access conversations or reply. Never request passwords, PINs, verification
          codes, or identity documents. Support cannot initiate refunds or change ledger records.
        </div>
      </div>

      {notice && (
        <div className="ops-banner info" style={{ padding: "10px 14px", fontSize: "12px" }}>
          <span>ℹ️</span>
          <div>{notice}</div>
        </div>
      )}

      {error ? (
        <Fail code={error} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selected ? "1.2fr 1.8fr" : "1fr",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Open Requests Data Table Card */}
            <div className="data-table-card">
              <div className="table-header-bar">
                <div>
                  <h3>Open Support Inquiries</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Customer tickets awaiting operational response or triage
                  </p>
                </div>
                <span
                  className="pill-badge"
                  style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}
                >
                  {items.length} Tickets
                </span>
              </div>

              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Subject Title</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {!items.length ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)" }}
                      >
                        No open support cases.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.reference}
                        style={{
                          background:
                            selected?.reference === item.reference ? "#EFF6FF" : "inherit",
                        }}
                      >
                        <td>
                          <span className="table-id-link">{item.reference}</span>
                        </td>
                        <td>
                          <strong>{item.subject}</strong>
                        </td>
                        <td>
                          <span
                            className="pill-badge"
                            style={{
                              background:
                                item.status === "OPEN" ? "var(--amber-bg)" : "var(--green-bg)",
                              color:
                                item.status === "OPEN" ? "var(--amber-text)" : "var(--green-text)",
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn-pill primary"
                            style={{ height: "30px", fontSize: "11px" }}
                            onClick={() => void select(item.reference)}
                          >
                            Review &rarr;
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Read-Only Dispute Reviews Card */}
            <div className="data-table-card">
              <div className="table-header-bar">
                <div>
                  <h3>Financial dispute review (read only)</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Support responses cannot authorize reversals; cases remain governed by dispute
                    controls
                  </p>
                </div>
                <span
                  className="pill-badge"
                  style={{ background: "var(--purple-bg)", color: "var(--purple-text)" }}
                >
                  {disputes.length} Disputes
                </span>
              </div>

              {disputesUnavailable ? (
                <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>
                  Financial dispute review is unavailable or your account lacks permission.
                </div>
              ) : !disputes.length ? (
                <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>
                  No open financial disputes in current scope.
                </div>
              ) : (
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Dispute Ref</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Reason Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disputes.map((d) => (
                      <tr key={d.reference}>
                        <td>
                          <span className="table-id-link">{d.reference}</span>
                        </td>
                        <td>{d.category}</td>
                        <td>
                          <span
                            className="pill-badge"
                            style={{ background: "var(--coral-bg)", color: "var(--coral-text)" }}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "12px",
                          }}
                        >
                          {d.reasonCode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Ticket Messages Thread Detail Card */}
          {selected && (
            <div
              className="ops-panel"
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid var(--border-light)",
                  paddingBottom: "14px",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px" }}>{selected.subject}</h2>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      marginTop: "3px",
                      display: "block",
                    }}
                  >
                    Category: {selected.category} &bull; Case: {selected.reference}
                  </span>
                </div>
                <span
                  className="pill-badge"
                  style={{
                    background: selected.status === "OPEN" ? "var(--amber-bg)" : "var(--green-bg)",
                    color: selected.status === "OPEN" ? "var(--amber-text)" : "var(--green-text)",
                  }}
                >
                  {selected.status}
                </span>
              </div>

              {/* Chat Thread Bubbles */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  maxHeight: "400px",
                  overflowY: "auto",
                  padding: "8px 0",
                }}
              >
                {selected.messages.map((m) => {
                  const isStaff = m.authorType === "STAFF";
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isStaff ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        background: isStaff ? "var(--brand-blue)" : "var(--surface-subtle)",
                        color: isStaff ? "#FFFFFF" : "var(--text-main)",
                        borderRadius: "16px",
                        padding: "12px 16px",
                        border: isStaff ? "none" : "1px solid var(--border-subtle)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          fontSize: "11px",
                          opacity: 0.85,
                          marginBottom: "4px",
                        }}
                      >
                        <strong>{isStaff ? "Support Operations Team" : "Customer Inquirer"}</strong>
                        <span>{new Date(m.createdAt).toLocaleString("en-NG")}</span>
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              {selected.status !== "CLOSED" && (
                <form
                  onSubmit={submit}
                  style={{
                    borderTop: "1px solid var(--border-light)",
                    paddingTop: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <label
                    htmlFor="support-response"
                    style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)" }}
                  >
                    Draft Response to Customer
                  </label>
                  <textarea
                    id="support-response"
                    rows={3}
                    maxLength={3000}
                    minLength={2}
                    required
                    value={reply}
                    onChange={(e) => {
                      setReply(e.target.value);
                      requestKey.current = null;
                    }}
                    className="pill-input"
                    style={{
                      height: "auto",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      resize: "vertical",
                    }}
                    placeholder="Type official support message. Confidential messages are encrypted at rest."
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Encrypted at rest &bull; Attachment transfer disabled
                    </span>
                    <div className="actions-inline">
                      <button
                        type="button"
                        className="btn-pill danger"
                        disabled={busy}
                        onClick={() => void close()}
                        style={{ height: "36px" }}
                      >
                        Close Case
                      </button>
                      <button
                        type="submit"
                        className="btn-pill primary"
                        disabled={busy || reply.trim().length < 2}
                        style={{ height: "36px" }}
                      >
                        {busy ? "Sending..." : "Send Reply →"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </OpsShell>
  );
}
