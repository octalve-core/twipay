import "./styles.css";
import { headers } from "next/headers";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

// Fetched once at build time and served from this origin, so the strict CSP (font-src 'self') needs no external font host.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap", variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-mono" });
export const metadata = {
  title: "TwiPay Operations",
  description: "Restricted operations console for authorized TwiPay staff.",
};
// The CSP in proxy.ts is nonce-based ('strict-dynamic'), so every page must render per request for Next to
// stamp the nonce on its scripts; statically prerendered pages would have all of their scripts blocked.
export const dynamic = "force-dynamic";
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Local development inbox (compose.stack.yaml). The script needs the request nonce to pass the strict CSP.
  const devMail = process.env["NEXT_PUBLIC_DEV_MAIL"] === "true";
  const nonce = devMail ? ((await headers()).get("x-nonce") ?? undefined) : undefined;
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        {devMail && <script src="/__devmail/widget.js" nonce={nonce} async />}
      </body>
    </html>
  );
}
