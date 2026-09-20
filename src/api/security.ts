/**
 * Security hardening module — Milestone 6
 * Provides HTTP security headers and CORS configuration.
 */

/**
 * Returns security headers to apply to every response.
 * - HSTS: enforce HTTPS with 1-year max-age + includeSubDomains
 * - CSP: restrictive policy — no unsafe-inline, no unsafe-eval, default-src 'self'
 * - X-Content-Type-Options: prevent MIME-type sniffing
 * - X-Frame-Options: prevent clickjacking via iframes
 * - Referrer-Policy: prevent URL/note-id leakage
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'content-security-policy': "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
  };
}

/**
 * Returns CORS headers for same-origin only policy.
 * No wildcard — we don't set access-control-allow-origin at all for
 * cross-origin requests. This is applied only on OPTIONS preflight.
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
    'access-control-allow-headers': 'content-type, x-delete-token',
  };
}

/**
 * Applies security headers to a Headers object (mutates in place).
 */
export function applySecurityHeaders(headers: Headers): void {
  const securityHeaders = getSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }
}
