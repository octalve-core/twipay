import type { NextConfig } from 'next';
const securityHeaders = [
  ...(process.env['NODE_ENV'] === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }
];
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
  // Local development inbox only (compose.stack.yaml): same-origin read/clear proxy, evaluated at build time.
  async rewrites() {
    if (process.env['NEXT_PUBLIC_DEV_MAIL'] !== 'true') return [];
    return [
      { source: '/__devmail/widget.js', destination: 'http://devmail:8025/widget.js' },
      { source: '/__devmail/api/messages', destination: 'http://devmail:8025/api/messages' },
    ];
  },
};
export default config;
