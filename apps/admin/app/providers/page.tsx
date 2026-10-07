"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { OpsShell } from '../_components/ops-shell';
import { Fail, Wait } from '../_components/state';
import { money, opsGet, opsMutation } from '../_lib/api';

type Health = { id: string; providerCode: string; capability: string; circuitState: string; consecutiveFailures: number; successCount: string; failureCount: string };
type Product = { id: string; code: string; name: string; category: string; currency: string; customerIdentifierType: string; fixedAmountMinor: string | null; minAmountMinor: string | null; maxAmountMinor: string | null };
type Offer = { id: string; providerCode: string; providerProductCode: string; productId: string; priority: number; estimatedCostMinor: string | null; active: boolean; product: Product };
type Snapshot = { health: Health[]; offers: Offer[] };

export default function ProvidersPage() {
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try { setData(await opsGet<Snapshot>('/operations/providers')); setError(''); }
    catch (cause: any) { setError(cause.code ?? 'REQUEST_FAILED'); }
  }
  useEffect(() => { void load(); }, []);

  const canonicalProducts = useMemo(() => {
    const map = new Map<string, Product>();
    for (const offer of data?.offers ?? []) map.set(offer.product.id, offer.product);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  async function toggle(offer: Offer) {
    try {
      await opsMutation(`/operations/providers/offers/${offer.id}`, { active: !offer.active, reason: 'Operations routing activation control change' }, 'PATCH');
      setMessage(`${offer.providerCode}/${offer.providerProductCode} ${offer.active ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'ACTION_BLOCKED'); }
  }

  async function updateRouting(event: FormEvent<HTMLFormElement>, offer: Offer) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const priority = Number(form.get('priority'));
    const costText = String(form.get('estimatedCostMinor') ?? '').trim();
    try {
      await opsMutation(`/operations/providers/offers/${offer.id}`, {
        priority,
        estimatedCostMinor: costText ? costText : null,
        reason: String(form.get('reason')),
      }, 'PATCH');
      setMessage(`${offer.providerCode}/${offer.providerProductCode} routing controls updated.`);
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'ROUTING_CONTROL_BLOCKED'); }
  }

  async function resetCircuit(health: Health) {
    const reason = window.prompt(`Reason to reset ${health.providerCode} ${health.capability} circuit?`);
    if (!reason || reason.trim().length < 5) return;
    try {
      await opsMutation(`/operations/providers/health/${health.id}/reset`, { reason });
      setMessage(`${health.providerCode}/${health.capability} circuit reset to CLOSED.`);
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'CIRCUIT_RESET_BLOCKED'); }
  }

  async function verifyMapping(event: FormEvent<HTMLFormElement>, offer: Offer) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const canonicalProductId = String(form.get('canonicalProductId'));
    if (!canonicalProductId || canonicalProductId === offer.productId) {
      setMessage('Choose a different canonical product. TwiPay will still reject any semantic mismatch server-side.');
      return;
    }
    try {
      await opsMutation(`/operations/catalog/offers/${offer.id}/verify-equivalence`, {
        canonicalProductId,
        reason: String(form.get('reason')),
        evidence: {
          source: String(form.get('source')),
          verificationNote: String(form.get('verificationNote')),
          verifiedProductName: String(form.get('verifiedProductName')),
        },
      });
      setMessage(`${offer.providerCode}/${offer.providerProductCode} remapped only after server-side exact semantic validation.`);
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'SKU_MAPPING_BLOCKED'); }
  }

  return (
    <OpsShell title="Provider routing">
      {error ? <Fail code={error} /> : !data ? <Wait /> : <>
        <div className="ops-note"><strong>No guessed equivalence</strong><span>Operators may propose a mapping only with human evidence. The server then requires exact category, currency, customer-identifier and amount semantics before the mapping can change.</span></div>

        <section className="ops-panel">
          <h2>Provider health & circuit breakers</h2>
          <div className="table compact"><div className="tr th"><span>Provider</span><span>Capability</span><span>Circuit</span><span>Failures / control</span></div>{data.health.map((health) => <div className="tr" key={health.id}><span>{health.providerCode}<small>{health.successCount} successes · {health.failureCount} failures</small></span><span>{health.capability}</span><span>{health.circuitState}</span><span>{health.consecutiveFailures}<div className="actions-inline"><button className="secondary" onClick={() => resetCircuit(health)}>Reset circuit</button></div></span></div>)}</div>
        </section>

        <section className="ops-panel">
          <h2>Provider offers</h2>
          <div className="list">{data.offers.map((offer) => <div className="panel" key={offer.id}>
            <div className="list-row"><div><strong>{offer.providerCode} · {offer.providerProductCode}</strong><small>{offer.product.name} · {offer.product.code} · {offer.product.category}</small></div><div className="align-right"><strong>{offer.estimatedCostMinor ? money(offer.estimatedCostMinor, offer.product.currency) : 'Unreported cost'}</strong><small>priority {offer.priority} · {offer.active ? 'active' : 'disabled'}</small></div></div>
            <div className="actions-inline"><button className={offer.active ? 'secondary' : ''} onClick={() => toggle(offer)}>{offer.active ? 'Disable offer' : 'Enable offer'}</button></div>
            <form className="compact-form" onSubmit={(event) => updateRouting(event, offer)}>
              <h3>Routing controls</h3>
              <label>Priority (-100 to 100)<input name="priority" type="number" min={-100} max={100} defaultValue={offer.priority} required /></label>
              <label>Estimated provider cost (minor units)<input name="estimatedCostMinor" inputMode="numeric" pattern="[1-9]\d{0,17}" defaultValue={offer.estimatedCostMinor ?? ''} placeholder="Leave blank if unreported" /></label>
              <label>Reason<input name="reason" minLength={5} maxLength={500} defaultValue="Provider routing cost/priority review" required /></label>
              <button>Save routing controls</button>
            </form>
            <form className="compact-form" onSubmit={(event) => verifyMapping(event, offer)}>
              <h3>Verified canonical SKU mapping</h3>
              <label>Canonical product<select name="canonicalProductId" defaultValue="" required><option value="" disabled>Select exact equivalent…</option>{canonicalProducts.filter((product) => product.id !== offer.productId).map((product) => <option value={product.id} key={product.id}>{product.name} · {product.code} · {product.category}</option>)}</select></label>
              <label>Evidence source<input name="source" minLength={3} maxLength={1000} placeholder="Provider dashboard, signed schedule, official API response…" required /></label>
              <label>Verified product name<input name="verifiedProductName" minLength={2} maxLength={180} defaultValue={offer.product.name} required /></label>
              <label>Verification note<textarea name="verificationNote" minLength={10} maxLength={2000} placeholder="Explain exactly how plan, amount rules, identifier type and duration were verified." required /></label>
              <label>Reason<input name="reason" minLength={5} maxLength={500} defaultValue="Human-verified provider SKU equivalence" required /></label>
              <button>Verify & remap</button>
            </form>
          </div>)}</div>
          {message && <p className="small">{message}</p>}
        </section>
      </>}
    </OpsShell>
  );
}
