export default function HomePage() {
  return <main className="shell">
    <nav className="nav"><div className="brand">TwiPay</div><span className="badge">Octalve platform</span></nav>
    <section className="hero">
      <span className="badge">Secure financial & service orchestration</span>
      <h1>Money and essential services, made dependable.</h1>
      <p>TwiPay is being rebuilt as a Nigeria-first, provider-independent platform for wallet services, transfers, utilities and events—designed for secure operation and future licensing.</p>
      <div className="actions"><a className="button primary" href="/login">Sign in</a><a className="button" href="/register">Create account</a></div>
    </section>
    <section className="grid">
      <article className="card"><h2>Financial core</h2><p>Ledger-backed wallet architecture with auditable transactions and provider-independent rails.</p></article>
      <article className="card"><h2>Essential services</h2><p>Airtime, data, electricity and cable through a resilient routing layer.</p></article>
      <article className="card"><h2>Events</h2><p>Ticket sales, secure QR validation and event settlement are part of the first production surface.</p></article>
    </section>
  </main>;
}
