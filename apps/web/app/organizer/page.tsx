"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../_components/app-shell';
import { ErrorCard, LoadingCard } from '../_components/load-state';
import { apiGet, apiMutation, formatMinor, parseNgnMajorToMinor } from '../_lib/api';

type Organizer = {
  id: string;
  name: string;
  status: string;
  eventCount: number;
  settlement: { payableBalanceMinor: string };
};

type EventRecord = {
  id: string;
  organizerId: string;
  organizerName: string;
  title: string;
  status: string;
  startsAt: string;
};

type Payout = {
  reference: string;
  status: string;
  amountMinor: string;
  currency: string;
  providerCode: string;
  beneficiary: { accountName: string; accountNumberLast4: string; bankCode: string };
  rejectionReason?: string | null;
  createdAt?: string;
};

type PageData = { organizers: Organizer[]; events: EventRecord[]; payouts: Record<string, Payout[]> };

export default function OrganizerPage() {
  const [data, setData] = useState<PageData>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const result = await apiGet<{ organizers: Organizer[] }>('/events/organizers/me');
      const events: EventRecord[] = [];
      const payouts: Record<string, Payout[]> = {};
      for (const organizer of result.organizers) {
        const [eventResponse, payoutResponse] = await Promise.all([
          apiGet<{ events: Omit<EventRecord, 'organizerName'>[] }>(`/events/organizers/${organizer.id}/events`),
          apiGet<{ payouts: Payout[] }>(`/events/organizers/${organizer.id}/payouts`),
        ]);
        events.push(...eventResponse.events.map((event) => ({ ...event, organizerName: organizer.name })));
        payouts[organizer.id] = payoutResponse.payouts;
      }
      setData({ organizers: result.organizers, events, payouts });
      setError('');
    } catch (cause: any) {
      setError(cause.code ?? 'REQUEST_FAILED');
    }
  }

  useEffect(() => { void load(); }, []);

  const payoutRows = useMemo(() => {
    if (!data) return [];
    return data.organizers.flatMap((organizer) => (data.payouts[organizer.id] ?? []).map((payout) => ({ organizer, payout })));
  }, [data]);

  async function createOrganizer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiMutation('/events/organizers', 'POST', { name: String(form.get('name')), slug: String(form.get('slug')) });
      setMessage('Organizer created.');
      event.currentTarget.reset();
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'ORGANIZER_CREATE_BLOCKED'); }
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiMutation('/events', 'POST', {
        organizerId: String(form.get('organizerId')),
        slug: String(form.get('slug')),
        title: String(form.get('title')),
        venueName: String(form.get('venueName') || '') || undefined,
        startsAt: new Date(String(form.get('startsAt'))).toISOString(),
      });
      setMessage('Draft event created. Add a ticket type before publishing.');
      event.currentTarget.reset();
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'EVENT_CREATE_BLOCKED'); }
  }

  async function addTicket(eventId: string) {
    const name = window.prompt('Ticket type name (for example, General Admission)');
    const amount = window.prompt('Price in NGN');
    const capacity = window.prompt('Capacity');
    if (!name || !amount || !capacity) return;
    try {
      await apiMutation(`/events/${eventId}/ticket-types`, 'POST', { name, priceMinor: parseNgnMajorToMinor(amount), capacity: Number(capacity) });
      setMessage('Ticket type added.');
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'TICKET_TYPE_BLOCKED'); }
  }

  async function publish(eventId: string) {
    try {
      await apiMutation(`/events/${eventId}/publish`, 'POST');
      setMessage('Event published.');
      await load();
    } catch (cause: any) { setMessage(cause.code ?? 'PUBLISH_BLOCKED'); }
  }

  async function assignStaff(eventId: string) {
    const email = window.prompt('Existing TwiPay user email for check-in access');
    if (!email) return;
    try {
      await apiMutation(`/events/${eventId}/staff`, 'POST', { email });
      setMessage('Check-in staff assigned.');
    } catch (cause: any) { setMessage(cause.code ?? 'STAFF_ASSIGNMENT_BLOCKED'); }
  }

  async function requestPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organizerId = String(form.get('organizerId'));
    try {
      await apiMutation(`/events/organizers/${organizerId}/payouts`, 'POST', {
        provider: String(form.get('provider')),
        amountMinor: parseNgnMajorToMinor(String(form.get('amount'))),
        bankCode: String(form.get('bankCode')),
        accountNumber: String(form.get('accountNumber')),
        narration: String(form.get('narration')),
      }, { idempotent: true });
      setMessage('Your payout request has been received and is awaiting approval.');
      event.currentTarget.reset();
      await load();
    } catch (cause: any) {
      setMessage(cause.code === 'FEATURE_DISABLED' ? 'Organizer payouts are not activated yet. Your settlement remains in TwiPay until the live payout control is enabled.' : (cause.code ?? 'PAYOUT_REQUEST_BLOCKED'));
    }
  }

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiMutation<any>('/events/tickets/check-in', 'POST', { qrPayload: String(form.get('credential')), requestId: crypto.randomUUID() });
      setMessage(`${result.ticket.publicCode} checked in for ${result.ticket.eventTitle}.`);
      event.currentTarget.reset();
    } catch (cause: any) { setMessage(cause.code ?? 'CHECK_IN_BLOCKED'); }
  }

  return (
    <AppShell title="Organizer" subtitle="Create events, delegate check-in, and manage settlement without mixing organizer funds with customer wallet balances.">
      {error ? <ErrorCard message={error} /> : !data ? <LoadingCard /> : <>
        <div className="two-col">
          <section className="panel">
            <h2>Create organizer</h2>
            <form className="compact-form" onSubmit={createOrganizer}>
              <label>Name<input name="name" required /></label>
              <label>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
              <button className="button primary">Create organizer</button>
            </form>
          </section>
          <section className="panel">
            <h2>Create event</h2>
            <form className="compact-form" onSubmit={createEvent}>
              <label>Organizer<select name="organizerId" required>{data.organizers.map((organizer) => <option value={organizer.id} key={organizer.id}>{organizer.name}</option>)}</select></label>
              <label>Event title<input name="title" required /></label>
              <label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
              <label>Venue<input name="venueName" /></label>
              <label>Starts at<input name="startsAt" type="datetime-local" required /></label>
              <button className="button primary" disabled={!data.organizers.length}>Create draft event</button>
            </form>
          </section>
        </div>

        <section className="panel">
          <h2>Your organizers</h2>
          <div className="list">{data.organizers.map((organizer) => <div className="list-row" key={organizer.id}><div><strong>{organizer.name}</strong><small>{organizer.eventCount} events · {organizer.status}</small></div><div className="align-right"><strong>{formatMinor(organizer.settlement.payableBalanceMinor, 'NGN')}</strong><small>Available for review</small></div></div>)}</div>
        </section>

        <section className="panel">
          <h2>Request settlement payout</h2>
          <p className="small">Submitting a payout request does not send money immediately. We will review your request and confirm its status.</p>
          <form className="compact-form" onSubmit={requestPayout}>
            <label>Organizer<select name="organizerId" required>{data.organizers.map((organizer) => <option value={organizer.id} key={organizer.id}>{organizer.name}</option>)}</select></label>
            <label>Provider<select name="provider" defaultValue="monnify"><option value="monnify">Monnify</option><option value="paystack">Paystack</option></select></label>
            <label>Amount (NGN)<input name="amount" inputMode="decimal" placeholder="50000.00" required /></label>
            <label>Bank code<input name="bankCode" inputMode="numeric" minLength={2} maxLength={20} required /></label>
            <label>Account number<input name="accountNumber" inputMode="numeric" pattern="\d{10}" maxLength={10} required /></label>
            <label>Narration<input name="narration" minLength={3} maxLength={120} defaultValue="TwiPay event settlement" required /></label>
            <button className="button primary" disabled={!data.organizers.length}>Request payout</button>
          </form>
        </section>

        <section className="panel">
          <h2>Payout history</h2>
          {payoutRows.length ? <div className="list">{payoutRows.map(({ organizer, payout }) => <div className="list-row" key={payout.reference}><div><strong>{organizer.name} · {payout.status}</strong><small>{payout.reference} · {payout.providerCode} · {payout.beneficiary.accountName} · •••• {payout.beneficiary.accountNumberLast4}</small>{payout.rejectionReason ? <small>{payout.rejectionReason}</small> : null}</div><div className="align-right"><strong>{formatMinor(payout.amountMinor, payout.currency)}</strong><small>{payout.createdAt ? new Date(payout.createdAt).toLocaleString() : 'Settlement request'}</small></div></div>)}</div> : <p className="small">No payout requests yet.</p>}
        </section>

        <section className="panel">
          <h2>Event management</h2>
          <div className="list">{data.events.map((event) => <div className="list-row" key={event.id}><div><strong>{event.title}</strong><small>{event.organizerName} · {event.status} · {new Date(event.startsAt).toLocaleString()}</small></div><div className="actions-inline"><button className="button" onClick={() => addTicket(event.id)}>Add ticket</button>{event.status === 'DRAFT' && <button className="button" onClick={() => publish(event.id)}>Publish</button>}<button className="button" onClick={() => assignStaff(event.id)}>Assign check-in staff</button></div></div>)}</div>
        </section>

        <section className="panel">
          <h2>Ticket check-in</h2>
          <form className="compact-form" onSubmit={checkIn}>
            <label>Scanned QR credential<textarea name="credential" required minLength={60} maxLength={300} /></label>
            <button className="button primary">Validate & check in</button>
          </form>
          <p className="small">Only the organizer owner or an active event-specific CHECK_IN delegate can redeem a credential.</p>
        </section>
        {message && <section className="panel"><p className="small">{message}</p></section>}
      </>}
    </AppShell>
  );
}
