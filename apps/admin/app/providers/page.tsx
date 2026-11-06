"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { OpsShell } from "../_components/ops-shell";
import { Fail, Wait } from "../_components/state";
import { money, opsGet, opsMutation, explainCode } from "../_lib/api";
import { FreezeRailModal, ModalDialog } from "../_components/modals";

type Health = {
  id: string;
  providerCode: string;
  capability: string;
  circuitState: string;
  consecutiveFailures: number;
  successCount: string;
  failureCount: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  currency: string;
  customerIdentifierType: string;
  fixedAmountMinor: string | null;
  minAmountMinor: string | null;
  maxAmountMinor: string | null;
};

type Offer = {
  id: string;
  providerCode: string;
  providerProductCode: string;
  productId: string;
  priority: number;
  estimatedCostMinor: string | null;
  active: boolean;
  product: Product;
};

type Snapshot = { health: Health[]; offers: Offer[] };

export default function ProvidersPage() {
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [resetTarget, setResetTarget] = useState<Health | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [freezeTarget, setFreezeTarget] = useState<Offer | null>(null);

  async function load() {
    try {
      setData(await opsGet<Snapshot>("/operations/providers"));
      setError("");
    } catch (cause: any) {
      setError(explainCode(cause.code, "REQUEST_FAILED"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const canonicalProducts = useMemo(() => {
    const map = new Map<string, Product>();
    for (const offer of data?.offers ?? []) map.set(offer.product.id, offer.product);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  async function toggle(offer: Offer) {
    if (offer.active) {
      // Opening freeze confirmation
      setFreezeTarget(offer);
      return;
    }
    // Enabling
    try {
      await opsMutation(
        `/operations/providers/offers/${offer.id}`,
        { active: true, reason: "Operations routing activation control change" },
        "PATCH"
      );
      setMessage(`${offer.providerCode}/${offer.providerProductCode} enabled.`);
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "ACTION_BLOCKED"));
    }
  }

  async function handleConfirmFreeze() {
    if (!freezeTarget) return;
    try {
      await opsMutation(
        `/operations/providers/offers/${freezeTarget.id}`,
        { active: false, reason: "Operations routing activation control change" },
        "PATCH"
      );
      setMessage(`${freezeTarget.providerCode}/${freezeTarget.providerProductCode} disabled.`);
      setFreezeTarget(null);
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "ACTION_BLOCKED"));
    }
  }

  async function updateRouting(event: FormEvent<HTMLFormElement>, offer: Offer) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const priority = Number(form.get("priority"));
    const costText = String(form.get("estimatedCostMinor") ?? "").trim();
    try {
      await opsMutation(
        `/operations/providers/offers/${offer.id}`,
        {
          priority,
          estimatedCostMinor: costText ? costText : null,
          reason: String(form.get("reason"))
        },
        "PATCH"
      );
      setMessage(`${offer.providerCode}/${offer.providerProductCode} routing controls updated.`);
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "ROUTING_CONTROL_BLOCKED"));
    }
  }

  async function handleConfirmResetCircuit() {
    if (!resetTarget || resetReason.trim().length < 5) return;
    try {
      await opsMutation(`/operations/providers/health/${resetTarget.id}/reset`, { reason: resetReason.trim() });
      setMessage(`${resetTarget.providerCode}/${resetTarget.capability} circuit reset to CLOSED.`);
      setResetTarget(null);
      setResetReason("");
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "CIRCUIT_RESET_BLOCKED"));
    }
  }

  async function verifyMapping(event: FormEvent<HTMLFormElement>, offer: Offer) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const canonicalProductId = String(form.get("canonicalProductId"));
    if (!canonicalProductId || canonicalProductId === offer.productId) {
      setMessage("Choose a different canonical product. TwiPay will still reject any semantic mismatch server-side.");
      return;
    }
    try {
      await opsMutation(`/operations/catalog/offers/${offer.id}/verify-equivalence`, {
        canonicalProductId,
        reason: String(form.get("reason")),
        evidence: {
          source: String(form.get("source")),
          verificationNote: String(form.get("verificationNote")),
          verifiedProductName: String(form.get("verifiedProductName"))
        }
      });
      setMessage(`${offer.providerCode}/${offer.providerProductCode} remapped only after server-side exact semantic validation.`);
      await load();
    } catch (cause: any) {
      setMessage(explainCode(cause.code, "SKU_MAPPING_BLOCKED"));
    }
  }

  return (
    <OpsShell
      title="Provider Routing &amp; Circuit Breaker Health"
      eyebrow="Switching Telemetry &amp; Failover Rails"
      actions={
        <button className="btn-pill" onClick={load}>
          ↻ Refresh Circuits
        </button>
      }
    >
      <div className="ops-banner info">
        <span>🔌</span>
        <div>
          <strong>No guessed equivalence:</strong> Operators may propose a mapping only with human evidence. The server then requires exact category, currency, customer-identifier and amount semantics before the mapping can change.
        </div>
      </div>

      {error ? (
        <Fail code={error} />
      ) : !data ? (
        <Wait />
      ) : (
        <>
          {message && (
            <div className="ops-banner" style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}>
              <span>ℹ️</span>
              <div>{message}</div>
            </div>
          )}

          {/* Circuit Health Metric Cards */}
          <div className="metrics-grid-4">
            {data.health.map((h) => {
              const isClosed = h.circuitState === "CLOSED";
              const isHalf = h.circuitState === "HALF_OPEN";
              return (
                <div className="metric-card" key={h.id}>
                  <div className="metric-data">
                    <span className="metric-label">{h.providerCode} &bull; {h.capability}</span>
                    <span
                      className="metric-value"
                      style={{ color: isClosed ? "#059669" : isHalf ? "#D97706" : "#DC2626", fontSize: "18px" }}
                    >
                      {h.circuitState}
                    </span>
                    <span className="metric-delta" style={{ color: isClosed ? "#059669" : "#DC2626" }}>
                      {h.consecutiveFailures} Failures ({h.successCount} succ)
                    </span>
                  </div>
                  <button
                    className="btn-pill"
                    style={{ height: "26px", fontSize: "10px" }}
                    onClick={() => {
                      setResetTarget(h);
                      setResetReason("");
                    }}
                  >
                    Reset circuit
                  </button>
                </div>
              );
            })}
          </div>

          {/* Offers & SKU Equivalence Mappings */}
          <div className="ops-panel">
            <h2>Provider Offers &amp; SKU Catalog Mapping</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {data.offers.map((offer) => (
                <div
                  key={offer.id}
                  style={{
                    border: "1px solid var(--border-light)",
                    borderRadius: "14px",
                    padding: "18px",
                    background: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "15px" }}>{offer.providerCode} &bull; {offer.providerProductCode}</strong>
                        <span
                          className="pill-badge"
                          style={{
                            background: offer.active ? "var(--green-bg)" : "var(--coral-bg)",
                            color: offer.active ? "var(--green-text)" : "var(--coral-text)"
                          }}
                        >
                          {offer.active ? "ACTIVE" : "DISABLED"}
                        </span>
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                        {offer.product.name} &bull; {offer.product.code} &bull; {offer.product.category}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--brand-blue)" }}>
                        {offer.estimatedCostMinor ? money(offer.estimatedCostMinor, offer.product.currency) : "Unreported cost"}
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        Priority {offer.priority} &bull; {offer.active ? "Active in router" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="actions-inline">
                    <button
                      className={offer.active ? "btn-pill danger" : "btn-pill primary"}
                      style={{ height: "30px", fontSize: "11px" }}
                      onClick={() => toggle(offer)}
                    >
                      {offer.active ? "Disable offer" : "Enable offer"}
                    </button>
                  </div>

                  {/* Routing controls form */}
                  <form
                    onSubmit={(event) => updateRouting(event, offer)}
                    className="ops-form"
                    style={{
                      background: "var(--surface-subtle)",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) 120px",
                      gap: "10px",
                      alignItems: "end"
                    }}
                  >
                    <label>
                      Priority (-100 to 100)
                      <input name="priority" type="number" min={-100} max={100} defaultValue={offer.priority} required className="pill-input" />
                    </label>
                    <label>
                      Estimated cost (minor)
                      <input name="estimatedCostMinor" inputMode="numeric" pattern="[1-9]\d{0,17}" defaultValue={offer.estimatedCostMinor ?? ""} placeholder="Blank if unrep" className="pill-input" />
                    </label>
                    <label>
                      Reason
                      <input name="reason" minLength={5} maxLength={500} defaultValue="Provider routing cost/priority review" required className="pill-input" />
                    </label>
                    <button type="submit" className="btn-pill" style={{ height: "38px" }}>
                      Routing controls
                    </button>
                  </form>

                  {/* Verified canonical SKU mapping form */}
                  <form
                    onSubmit={(event) => verifyMapping(event, offer)}
                    className="ops-form"
                    style={{
                      background: "var(--surface-subtle)",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--brand-blue)", marginBottom: "4px" }}>
                      Verified canonical SKU mapping
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <label>
                        Canonical product
                        <select name="canonicalProductId" defaultValue="" required className="pill-input">
                          <option value="" disabled>Select exact equivalent…</option>
                          {canonicalProducts.filter((product) => product.id !== offer.productId).map((product) => (
                            <option value={product.id} key={product.id}>
                              {product.name} &bull; {product.code} &bull; {product.category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Evidence source
                        <input name="source" minLength={3} maxLength={1000} placeholder="Provider dashboard, signed schedule..." required className="pill-input" />
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <label>
                        Verified product name
                        <input name="verifiedProductName" minLength={2} maxLength={180} defaultValue={offer.product.name} required className="pill-input" />
                      </label>
                      <label>
                        Reason
                        <input name="reason" minLength={5} maxLength={500} defaultValue="Human-verified provider SKU equivalence" required className="pill-input" />
                      </label>
                    </div>

                    <label>
                      Verification note (detailed plan, rules, and semantic matching)
                      <textarea
                        name="verificationNote"
                        minLength={10}
                        maxLength={2000}
                        rows={2}
                        placeholder="Explain exactly how plan, amount rules, identifier type and duration were verified."
                        required
                        className="pill-input"
                        style={{ height: "auto", borderRadius: "10px" }}
                      />
                    </label>

                    <div>
                      <button type="submit" className="btn-pill primary" style={{ height: "36px" }}>
                        Verify &amp; remap
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          </div>

          {/* Reset Circuit Modal */}
          {resetTarget && (
            <ModalDialog isOpen={!!resetTarget} onClose={() => setResetTarget(null)}>
              <div className="modal-badge-row">
                <div className="modal-avatar-badge modal-badge-amber">⚡</div>
                <div className="modal-title-wrap">
                  <h3>Reset Circuit Breaker</h3>
                  <p>Reset {resetTarget.providerCode} {resetTarget.capability} circuit state to CLOSED</p>
                </div>
                <button className="modal-close-btn" onClick={() => setResetTarget(null)}>&times;</button>
              </div>

              <div className="ops-banner info" style={{ margin: 0, padding: "10px 14px", fontSize: "12px" }}>
                <span>ℹ️</span>
                <div>
                  Resetting the circuit clears failure counters and re-admits automated settlement traffic immediately.
                </div>
              </div>

              <div className="ops-form" style={{ gap: "6px" }}>
                <label>
                  <span>Reason to Reset Circuit (min 5 characters)</span>
                  <input
                    type="text"
                    className="pill-input"
                    placeholder="e.g. Provider upstream incident resolved, test ping verified"
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-footer-actions">
                <button className="btn-pill" onClick={() => setResetTarget(null)}>Cancel</button>
                <button
                  className="btn-pill primary"
                  onClick={handleConfirmResetCircuit}
                  disabled={resetReason.trim().length < 5}
                >
                  Reset circuit &rarr;
                </button>
              </div>
            </ModalDialog>
          )}

          {/* Freeze Rail Emergency Modal */}
          {freezeTarget && (
            <FreezeRailModal
              isOpen={!!freezeTarget}
              onClose={() => setFreezeTarget(null)}
              onConfirm={handleConfirmFreeze}
              providerName={`${freezeTarget.providerCode} (${freezeTarget.providerProductCode})`}
            />
          )}
        </>
      )}
    </OpsShell>
  );
}
