"use client";

import { useEffect, useState, useMemo } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { opsGet, explainCode } from "../_lib/api";

export default function Audit() {
  const [d, setD] = useState<any>();
  const [e, setE] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    opsGet<any>("/operations/audit?limit=200")
      .then(setD)
      .catch((x) => setE(explainCode(x.code, "REQUEST_FAILED")));
  }, []);

  const filteredEvents = useMemo(() => {
    if (!d?.events) return [];
    return d.events.filter((v: any) => {
      const matchAction = filterAction === "ALL" || v.action?.toUpperCase().includes(filterAction);
      const matchSearch =
        !searchQuery ||
        v.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.targetType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.targetId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.actorUserId?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchAction && matchSearch;
    });
  }, [d, filterAction, searchQuery]);

  return (
    <OpsShell
      title="Operational Audit Trail"
      eyebrow="Immutable Double-Entry System Log"
      actions={
        <button
          className="btn-pill"
          onClick={() => {
            const blob = new Blob([JSON.stringify(d?.events || [], null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `twipay-audit-trail-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }}
        >
          Export Immutable JSON
        </button>
      }
    >
      <div className="ops-banner info">
        <span>📜</span>
        <div>
          <strong>Append-Only Audit Invariant:</strong> Every Maker-Checker approval, circuit trip, staff delegation, and policy modification writes an unalterable SHA-256 hashed journal record.
        </div>
      </div>

      {e ? (
        <Fail code={e} />
      ) : !d ? (
        <Wait />
      ) : (
        <>
          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {["ALL", "PAYOUT", "CIRCUIT", "STAFF", "TIER", "LOGIN"].map((tag) => (
                <button
                  key={tag}
                  className={`btn-pill ${filterAction === tag ? "primary" : ""}`}
                  style={{ height: "32px", fontSize: "11px" }}
                  onClick={() => setFilterAction(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div style={{ width: "280px" }}>
              <input
                type="text"
                placeholder="Filter by actor, target UUID, or action..."
                className="pill-input"
                style={{ height: "34px", fontSize: "12px" }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Audit Trail Data Table Card */}
          <div className="data-table-card">
            <div className="table-header-bar">
              <div>
                <h3>Audited System Events (Recent 200 Entries)</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Cryptographically chained operations and security transitions
                </p>
              </div>
              <span className="pill-badge" style={{ background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                {filteredEvents.length} Matched Events
              </span>
            </div>

            <table className="ops-table">
              <thead>
                <tr>
                  <th>Audit Action</th>
                  <th>Target Type &amp; Identifier</th>
                  <th>Actor ID / Service</th>
                  <th style={{ textAlign: "right" }}>Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                      No audit events match current filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((v: any) => {
                    const isDanger = v.action?.includes("REJECT") || v.action?.includes("DISABLE") || v.action?.includes("FREEZE");
                    const isSuccess = v.action?.includes("APPROVE") || v.action?.includes("CREATE") || v.action?.includes("GRANT");

                    return (
                      <tr key={v.id}>
                        <td>
                          <span
                            className="pill-badge"
                            style={{
                              background: isDanger ? "var(--coral-bg)" : isSuccess ? "var(--green-bg)" : "var(--brand-blue-light)",
                              color: isDanger ? "var(--coral-text)" : isSuccess ? "var(--green-text)" : "var(--brand-blue)"
                            }}
                          >
                            {v.action}
                          </span>
                        </td>
                        <td>
                          <strong>{v.targetType}</strong>
                          <span className="table-id-link" style={{ display: "block", fontSize: "11px", marginTop: "2px" }}>
                            {v.targetId || "—"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
                            {v.actorUserId}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "var(--text-muted)" }}>
                          {new Date(v.occurredAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </OpsShell>
  );
}
