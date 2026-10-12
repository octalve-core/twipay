import './styles.css';
export const metadata = { title: 'TwiPay Operations', description: 'Restricted operations console for authorized TwiPay staff.' };
// The CSP in proxy.ts is nonce-based ('strict-dynamic'), so every page must render per request for Next to
// stamp the nonce on its scripts; statically prerendered pages would have all of their scripts blocked.
export const dynamic = 'force-dynamic';
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
