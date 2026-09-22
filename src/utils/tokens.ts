/**
 * Shared token comparison.
 * Portable XOR-based constant-time comparison — works in Node and
 * Cloudflare Workers (no Buffer / node:crypto dependency).
 */

export function safeCompareTokens(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}