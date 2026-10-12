/** Normalize React Router pathname for UI capability gating, including case/encoded paths.
 * This is defense in depth ONLY: NestJS session, MFA, RBAC and financial flags remain authoritative.
 */
export function normalizeRoutePath(pathname: string): string | null {
  if (!pathname.startsWith('/') || pathname.includes('?') || pathname.includes('#')) return null;
  try {
    const segments = pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
    // Encoded slashes, dot segments and control characters may not change the capability boundary.
    if (segments.some((part) => part === '.' || part === '..' || /[\\/\x00-\x1f\x7f]/.test(part))) return null;
    return '/' + segments.map((part) => part.toLowerCase()).join('/');
  } catch { return null; }
}

/** Prevent a case/encoding alias from bypassing a deferred or excluded prefix. */
export function isPathUnderAnyPrefix(path: string, prefixes: readonly string[]): boolean {
  const current = normalizeRoutePath(path);
  if (current === null) return true; // fail closed for malformed pathname
  return prefixes.some((raw) => {
    const prefix = normalizeRoutePath(raw);
    return prefix !== null && (current === prefix || current.startsWith(`${prefix}/`));
  });
}
