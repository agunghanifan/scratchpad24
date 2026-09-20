/**
 * Tests for security hardening — Milestone 6
 * Verifies HTTP security headers, CORS, and HTTPS enforcement
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GenericRequest, GenericResponse, Handler } from './types';

function createMockHandler(response: GenericResponse): Handler {
  return vi.fn(async (_req: GenericRequest) => response);
}

describe('security hardening', () => {
  let adaptHandler: (handler: Handler) => (platformReq: Request) => Promise<Response>;
  let getSecurityHeaders: () => Record<string, string>;

  beforeEach(async () => {
    vi.resetModules();
    const adapterMod = await import('./adapter');
    adaptHandler = adapterMod.adaptHandler;
    const securityMod = await import('./security');
    getSecurityHeaders = securityMod.getSecurityHeaders;
  });

  describe('security headers module', () => {
    it('exports getSecurityHeaders function', async () => {
      const securityMod = await import('./security');
      expect(typeof securityMod.getSecurityHeaders).toBe('function');
    });

    it('returns an object with all required security headers', () => {
      const headers = getSecurityHeaders();
      expect(headers).toHaveProperty('strict-transport-security');
      expect(headers).toHaveProperty('content-security-policy');
      expect(headers).toHaveProperty('x-content-type-options');
      expect(headers).toHaveProperty('x-frame-options');
      expect(headers).toHaveProperty('referrer-policy');
    });
  });

  describe('Strict-Transport-Security header', () => {
    it('includes HSTS header with max-age=31536000', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const hsts = res.headers.get('strict-transport-security');
      expect(hsts).toBeTruthy();
      expect(hsts).toContain('max-age=31536000');
    });

    it('includes includeSubDomains directive', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const hsts = res.headers.get('strict-transport-security');
      expect(hsts).toContain('includeSubDomains');
    });
  });

  describe('Content-Security-Policy header', () => {
    it('includes CSP header', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const csp = res.headers.get('content-security-policy');
      expect(csp).toBeTruthy();
    });

    it('blocks unsafe-inline', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const csp = res.headers.get('content-security-policy');
      expect(csp).not.toContain('unsafe-inline');
    });

    it('blocks unsafe-eval', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const csp = res.headers.get('content-security-policy');
      expect(csp).not.toContain('unsafe-eval');
    });

    it('has restrictive default-src', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const csp = res.headers.get('content-security-policy');
      expect(csp).toContain('default-src');
      expect(csp).toMatch(/default-src\s+('self'|'none')/);
    });
  });

  describe('X-Content-Type-Options header', () => {
    it('sets X-Content-Type-Options to nosniff', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });

  describe('X-Frame-Options header', () => {
    it('sets X-Frame-Options to DENY', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('x-frame-options')).toBe('DENY');
    });
  });

  describe('Referrer-Policy header', () => {
    it('sets Referrer-Policy to no-referrer', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('prevents note URL leakage via referrer', async () => {
      const handler = createMockHandler({
        status: 200,
        body: { id: 'secret-note-id', content: 'Secret' },
        headers: {},
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/secret-note-id', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });
  });

  describe('security headers on all responses', () => {
    it('includes security headers on successful 200 responses', async () => {
      const handler = createMockHandler({
        status: 200, body: { id: 'abc', content: 'Test' },
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on 201 Created responses', async () => {
      const handler = createMockHandler({
        status: 201, body: { id: 'new-note' },
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Test' }),
      });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on 204 No Content responses', async () => {
      const handler = createMockHandler({ status: 204, body: null, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'DELETE' });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });
  describe('security headers on error responses', () => {
    it('includes security headers on 400 Bad Request (malformed JSON)', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ invalid json }',
      });
      const res = await adapted(req);
      expect(res.status).toBe(400);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on 413 Payload Too Large (Content-Length)', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(201 * 1024),
        },
        body: JSON.stringify({ content: 'x' }),
      });
      const res = await adapted(req);
      expect(res.status).toBe(413);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on 413 Payload Too Large (actual body)', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const bigContent = 'x'.repeat(201 * 1024);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '10',
        },
        body: JSON.stringify({ content: bigContent }),
      });
      const res = await adapted(req);
      expect(res.status).toBe(413);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on 429 Too Many Requests', async () => {
      const handler = createMockHandler({
        status: 429,
        body: { error: 'Rate limit exceeded' },
        headers: { 'retry-after': '60' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', { method: 'POST' });
      const res = await adapted(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on 500 Internal Server Error', async () => {
      const handler: Handler = vi.fn(async () => { throw new Error('Crash'); });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Test' }),
      });
      const res = await adapted(req);
      expect(res.status).toBe(500);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on 404 Not Found', async () => {
      const handler = createMockHandler({
        status: 404, body: { error: 'Not found' }, headers: {},
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/nonexistent', { method: 'GET' });
      const res = await adapted(req);
      expect(res.status).toBe(404);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });
  });

  describe('CORS: same-origin only', () => {
    it('does not include CORS headers by default', async () => {
      const handler = createMockHandler({
        status: 200, body: {},
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('does not allow wildcard origins', async () => {
      const handler = createMockHandler({
        status: 200, body: {},
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', {
        method: 'GET',
        headers: { 'origin': 'https://evil.com' },
      });
      const res = await adapted(req);
      expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('handles OPTIONS preflight with 204 status', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'OPTIONS',
        headers: { 'origin': 'https://example.com' },
      });
      const res = await adapted(req);
      expect(res.status).toBe(204);
    });

    it('OPTIONS preflight includes allowed methods', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', { method: 'OPTIONS' });
      const res = await adapted(req);
      const allowMethods = res.headers.get('access-control-allow-methods');
      expect(allowMethods).toBeTruthy();
      expect(allowMethods).toContain('GET');
      expect(allowMethods).toContain('POST');
      expect(allowMethods).toContain('PUT');
      expect(allowMethods).toContain('DELETE');
    });

    it('OPTIONS preflight includes allowed headers', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', { method: 'OPTIONS' });
      const res = await adapted(req);
      const allowHeaders = res.headers.get('access-control-allow-headers');
      expect(allowHeaders).toBeTruthy();
      expect(allowHeaders).toContain('content-type');
      expect(allowHeaders).toContain('x-delete-token');
    });

    it('OPTIONS preflight includes security headers', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', { method: 'OPTIONS' });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });
  });

  describe('security headers on all endpoints', () => {
    it('includes security headers on create note endpoint', async () => {
      const handler = createMockHandler({
        status: 201, body: { id: 'new-note' },
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Test' }),
      });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on get note endpoint', async () => {
      const handler = createMockHandler({
        status: 200, body: { id: 'abc', content: 'Test' },
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on update note endpoint', async () => {
      const handler = createMockHandler({
        status: 200, body: { id: 'abc', content: 'Updated' },
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Updated' }),
      });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });

    it('includes security headers on delete note endpoint', async () => {
      const handler = createMockHandler({ status: 204, body: null, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', {
        method: 'DELETE',
        headers: { 'x-delete-token': 'valid-token' },
      });
      const res = await adapted(req);
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      expect(res.headers.get('content-security-policy')).toBeTruthy();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    });
  });

  describe('HTTPS enforcement', () => {
    it('HSTS header enforces HTTPS-only connections', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const hsts = res.headers.get('strict-transport-security');
      expect(hsts).toBeTruthy();
      expect(hsts).toMatch(/max-age=\d+/);
      const maxAge = parseInt(hsts!.match(/max-age=(\d+)/)![1], 10);
      expect(maxAge).toBeGreaterThanOrEqual(31536000);
    });
  });
});

  });
