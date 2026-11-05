import { authSteps, routeShots, walkthroughSteps } from "./guideData";

const base = "/guide/";
const groups = ["Public pages", "Dashboard"] as const;

function Figure({ file, title, text }: { file: string; title: string; text?: string }) {
  return (
    <figure
      style={{
        margin: 0,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <a href={base + file} target="_blank" rel="noreferrer">
        <img
          src={base + file}
          alt={title}
          loading="lazy"
          style={{
            width: "100%",
            display: "block",
            maxHeight: 360,
            objectFit: "cover",
            objectPosition: "top",
          }}
        />
      </a>
      <figcaption style={{ padding: "12px 14px" }}>
        <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>
        {text ? <span style={{ color: "#4b5563", fontSize: 14 }}>{text}</span> : null}
      </figcaption>
    </figure>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 16,
} as const;

export default function Guide() {
  return (
    <main
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "32px 16px 64px",
        fontFamily: "system-ui, sans-serif",
        color: "#111827",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>TwiPay guide (development build)</h1>
      <p style={{ color: "#4b5563", maxWidth: 720 }}>
        Screenshots of what the app does today, captured on 2026-10-13. Click an image to open it
        full size. Emails in this build arrive in the floating inbox button. Features that are
        deferred by design (transfer to email, e-pins, eSIM, international top-ups, mobile money,
        flights, hotels, virtual cards, referral, affiliate) redirect to Services and are not shown.
        Known problems are listed in the issue log (docs/issues).
      </p>
      <h2 style={{ marginTop: 32 }}>Accounts: sign up, verify, sign in, reset</h2>
      <div style={grid}>
        {authSteps.map((s) => (
          <Figure key={s.file} file={s.file} title={s.title} text={s.text} />
        ))}
      </div>
      <h2 style={{ marginTop: 40 }}>Product walkthrough (2026-11-05)</h2>
      <p style={{ color: "#4b5563", maxWidth: 720 }}>
        Captured by the end-to-end walkthrough (tests/walkthrough) at commit 4f4e5cc. The staff-console
        screenshots from the same run are in docs/screenshots/2026-11-05-walkthrough.
      </p>
      <div style={grid}>
        {walkthroughSteps.map((s) => (
          <Figure key={s.file} file={s.file} title={s.title} text={s.text} />
        ))}
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h2 style={{ marginTop: 40 }}>{g}</h2>
          <div style={grid}>
            {routeShots
              .filter((r) => r.group === g)
              .map((r) => (
                <Figure key={r.route} file={r.file} title={r.route} text={r.note} />
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
