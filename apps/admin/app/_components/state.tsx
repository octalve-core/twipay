import { explainCode } from "../_lib/api";

export const Wait = () => (
  <div className="ops-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "28px", color: "var(--text-muted)" }}>
    <div style={{ width: "20px", height: "20px", border: "2px solid #E2E8F0", borderTopColor: "var(--brand-blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <span style={{ fontSize: "13px", fontWeight: 600 }}>Loading authorized ledger data…</span>
  </div>
);

export const Fail = ({ code }: { code: string }) => (
  <div className="ops-banner danger" style={{ padding: "16px 20px" }}>
    <span style={{ fontSize: "20px" }}>🛑</span>
    <div>
      <strong style={{ display: "block", fontSize: "14px" }}>Request Blocked or Ledger Unavailable</strong>
      <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px", display: "block" }}>
        {explainCode(code)}
      </span>
    </div>
  </div>
);
