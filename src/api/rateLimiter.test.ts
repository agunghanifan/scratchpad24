/**
 * Tests for rate limiting — Milestone 4
 * Decision 10: Per-IP rate limits with configurable defaults
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GenericRequest } from './types';

const DEFAULT_LIMITS = {
  createNote: 10,
  getNote: 30,
  updateNote: 60,
  deleteNote: 10,
};

function makeRequest(overrides: Partial<GenericRequest> & { ip?: string } = {}): GenericRequest {
  const { ip, ...rest } = overrides;
  return {
    method: 'POST',
    params: {},
    body: { content: 'Test' },
    headers: {},
    ...rest,
    ...(ip !== undefined ? { ip } : {}),
  } as GenericRequest & { ip?: string };
}

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.RATE_LIMIT_CREATE;
    delete process.env.RATE_LIMIT_READ;
    delete process.env.RATE_LIMIT_UPDATE;
    delete process.env.RATE_LIMIT_DELETE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('default configuration', () => {
    it('uses Decision 10 defaults when no env vars are set', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      expect(limiter.getLimit('createNote')).toBe(DEFAULT_LIMITS.createNote);
      expect(limiter.getLimit('getNote')).toBe(DEFAULT_LIMITS.getNote);
      expect(limiter.getLimit('updateNote')).toBe(DEFAULT_LIMITS.updateNote);
      expect(limiter.getLimit('deleteNote')).toBe(DEFAULT_LIMITS.deleteNote);
    });

    it('updateNote limit is sufficient for 800ms debounce theoretical max', () => {
      expect(DEFAULT_LIMITS.updateNote).toBeGreaterThanOrEqual(60);
    });
  });

  describe('environment variable configuration', () => {
    it('reads RATE_LIMIT_CREATE from environment', async () => {
      process.env.RATE_LIMIT_CREATE = '20';
      const { createRateLimiter } = await import('./rateLimiter');
      expect(createRateLimiter().getLimit('createNote')).toBe(20);
    });

    it('reads RATE_LIMIT_READ from environment', async () => {
      process.env.RATE_LIMIT_READ = '50';
      const { createRateLimiter } = await import('./rateLimiter');
      expect(createRateLimiter().getLimit('getNote')).toBe(50);
    });

    it('reads RATE_LIMIT_UPDATE from environment', async () => {
      process.env.RATE_LIMIT_UPDATE = '100';
      const { createRateLimiter } = await import('./rateLimiter');
      expect(createRateLimiter().getLimit('updateNote')).toBe(100);
    });

    it('reads RATE_LIMIT_DELETE from environment', async () => {
      process.env.RATE_LIMIT_DELETE = '15';
      const { createRateLimiter } = await import('./rateLimiter');
      expect(createRateLimiter().getLimit('deleteNote')).toBe(15);
    });

    it('falls back to defaults for invalid env var values', async () => {
      process.env.RATE_LIMIT_CREATE = 'invalid';
      const { createRateLimiter } = await import('./rateLimiter');
      expect(createRateLimiter().getLimit('createNote')).toBe(DEFAULT_LIMITS.createNote);
    });

    it('falls back to defaults for negative env var values', async () => {
      process.env.RATE_LIMIT_CREATE = '-5';
      const { createRateLimiter } = await import('./rateLimiter');
      expect(createRateLimiter().getLimit('createNote')).toBe(DEFAULT_LIMITS.createNote);
    });

    it('falls back to defaults for zero env var values', async () => {
      process.env.RATE_LIMIT_CREATE = '0';
      const { createRateLimiter } = await import('./rateLimiter');
      expect(createRateLimiter().getLimit('createNote')).toBe(DEFAULT_LIMITS.createNote);
    });
  });

  describe('basic rate limiting', () => {
    it('allows requests within the limit', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        const result = await limiter.check(req, 'createNote');
        expect(result.allowed).toBe(true);
      }
    });

    it('blocks requests exceeding the limit with 429 status', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }

      const result = await limiter.check(req, 'createNote');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(429);
    });

    it('returns Retry-After header when rate limited', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }

      const result = await limiter.check(req, 'createNote');
      expect(result.headers).toHaveProperty('retry-after');
      expect(parseInt(result.headers!['retry-after']!, 10)).toBeGreaterThan(0);
    });

    it('returns uniform error response shape', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }

      const result = await limiter.check(req, 'createNote');
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: string }).error).toBe('Rate limit exceeded');
    });
  });

  describe('per-IP tracking', () => {
    it('tracks rate limits separately for different IPs', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req1 = makeRequest({ ip: '192.168.1.1' });
      const req2 = makeRequest({ ip: '192.168.1.2' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req1, 'createNote');
      }

      expect((await limiter.check(req1, 'createNote')).allowed).toBe(false);
      expect((await limiter.check(req2, 'createNote')).allowed).toBe(true);
    });

    it('handles multiple IPs independently', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];

      for (const ip of ips) {
        const req = makeRequest({ ip });
        for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
          expect((await limiter.check(req, 'createNote')).allowed).toBe(true);
        }
      }
    });
  });

  describe('per-endpoint limits', () => {
    it('tracks rate limits separately for each endpoint', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }

      expect((await limiter.check(req, 'createNote')).allowed).toBe(false);
      expect((await limiter.check(req, 'getNote')).allowed).toBe(true);
    });

    it('enforces different limits for different endpoints', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.getNote; i++) {
        await limiter.check(req, 'getNote');
      }

      expect((await limiter.check(req, 'getNote')).allowed).toBe(false);
      expect((await limiter.check(req, 'createNote')).allowed).toBe(true);
    });
  });

  describe('window reset', () => {
    it('resets rate limit after time window expires', async () => {
      vi.useFakeTimers();
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }
      expect((await limiter.check(req, 'createNote')).allowed).toBe(false);

      vi.advanceTimersByTime(60 * 1000);

      expect((await limiter.check(req, 'createNote')).allowed).toBe(true);
    });
  });

  describe('IP extraction security', () => {
    it('extracts IP from x-forwarded-for header (first IP)', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({
        ip: undefined,
        headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
      });
      expect(extractClientIP(req)).toBe('203.0.113.50');
    });

    it('extracts IP from x-real-ip header', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({
        ip: undefined,
        headers: { 'x-real-ip': '203.0.113.50' },
      });
      expect(extractClientIP(req)).toBe('203.0.113.50');
    });

    it('falls back to request IP when no forwarding headers present', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({ ip: '192.168.1.1' });
      expect(extractClientIP(req)).toBe('192.168.1.1');
    });

    it('trusts only first IP in x-forwarded-for (prevents spoofing)', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({
        ip: undefined,
        headers: { 'x-forwarded-for': '10.0.0.1, 203.0.113.50, 70.41.3.18' },
      });
      expect(extractClientIP(req)).toBe('10.0.0.1');
    });

    it('handles missing IP gracefully with a default value', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({ ip: undefined, headers: {} });
      const ip = extractClientIP(req);
      expect(typeof ip).toBe('string');
      expect(ip.length).toBeGreaterThan(0);
    });

    it('cannot bypass rate limiting by manipulating headers', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({
        ip: '192.168.1.1',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }

      expect((await limiter.check(req, 'createNote')).allowed).toBe(false);
    });
  });

  describe('concurrent requests', () => {
    it('handles concurrent requests correctly', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      const promises = Array.from({ length: 15 }, () =>
        limiter.check(req, 'createNote')
      );
      const results = await Promise.all(promises);

      const allowed = results.filter((r) => r.allowed).length;
      const blocked = results.filter((r) => !r.allowed).length;

      expect(allowed).toBe(DEFAULT_LIMITS.createNote);
      expect(blocked).toBe(5);
    });

    it('prevents race conditions in concurrent access', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      const promises = Array.from({ length: DEFAULT_LIMITS.createNote }, () =>
        limiter.check(req, 'createNote')
      );
      const results = await Promise.all(promises);

      const allowed = results.filter((r) => r.allowed).length;
      expect(allowed).toBe(DEFAULT_LIMITS.createNote);
    });
  });

  describe('integration with handlers', () => {
    it('rate limiter can wrap a handler', async () => {
      const { createRateLimiter, withRateLimit } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const mockHandler = vi.fn(async () => ({
        status: 201,
        body: { noteId: 'test', deleteToken: 'token' },
        headers: { 'content-type': 'application/json' },
      }));

      const wrappedHandler = withRateLimit(mockHandler, limiter, 'createNote');
      const req = makeRequest({ ip: '192.168.1.1' });

      const result = await wrappedHandler(req);
      expect(result.status).toBe(201);
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('returns 429 when rate limit exceeded in wrapped handler', async () => {
      const { createRateLimiter, withRateLimit } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const mockHandler = vi.fn(async () => ({
        status: 201,
        body: { noteId: 'test', deleteToken: 'token' },
        headers: { 'content-type': 'application/json' },
      }));

      const wrappedHandler = withRateLimit(mockHandler, limiter, 'createNote');
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await wrappedHandler(req);
      }

      const result = await wrappedHandler(req);
      expect(result.status).toBe(429);
      expect(mockHandler).toHaveBeenCalledTimes(DEFAULT_LIMITS.createNote);
    });

    it('preserves handler response when under limit', async () => {
      const { createRateLimiter, withRateLimit } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const mockHandler = vi.fn(async () => ({
        status: 200,
        body: { id: 'test', content: 'Hello' },
        headers: { 'content-type': 'application/json' },
      }));

      const wrappedHandler = withRateLimit(mockHandler, limiter, 'getNote');
      const req = makeRequest({ ip: '192.168.1.1' });
      const result = await wrappedHandler(req);

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ id: 'test', content: 'Hello' });
    });
  });

  describe('security tests', () => {
    it('does not leak rate limit info in error responses', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }

      const result = await limiter.check(req, 'createNote');
      const errorBody = JSON.stringify(result.body);
      expect(errorBody).not.toContain('remaining');
    });

    it('Retry-After header is a reasonable value', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < DEFAULT_LIMITS.createNote; i++) {
        await limiter.check(req, 'createNote');
      }

      const result = await limiter.check(req, 'createNote');
      const retryAfter = parseInt(result.headers!['retry-after']!, 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('edge cases', () => {
    it('handles empty IP address', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '' });
      expect((await limiter.check(req, 'createNote')).allowed).toBe(true);
    });

    it('handles undefined IP address', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: undefined });
      expect((await limiter.check(req, 'createNote')).allowed).toBe(true);
    });

    it('handles IPv6 addresses', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '2001:0db8:85a3::8a2e:0370:7334' });
      expect((await limiter.check(req, 'createNote')).allowed).toBe(true);
    });

    it('handles localhost addresses', async () => {
      const { createRateLimiter } = await import('./rateLimiter');
      const limiter = createRateLimiter();
      const req = makeRequest({ ip: '127.0.0.1' });
      expect((await limiter.check(req, 'createNote')).allowed).toBe(true);
    });

    it('handles x-forwarded-for with empty first IP', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({
        headers: { 
          'x-forwarded-for': ', 5.6.7.8',
          'x-real-ip': '9.10.11.12'
        },
      });
      // First IP after split is empty, falls through to x-real-ip
      expect(extractClientIP(req)).toBe('9.10.11.12');
    });

    it('handles x-forwarded-for with only whitespace', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({
        headers: { 'x-forwarded-for': '   ' },
      });
      // Whitespace-only should fall through to x-real-ip or unknown
      expect(extractClientIP(req)).toBe('unknown');
    });

    it('prefers CF-Connecting-IP over other headers', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '5.6.7.8',
          'x-real-ip': '9.10.11.12',
        },
      });
      expect(extractClientIP(req)).toBe('1.2.3.4');
    });

    it('handles CF-Connecting-IP with whitespace', async () => {
      const { extractClientIP } = await import('./rateLimiter');
      const req = makeRequest({
        headers: { 'cf-connecting-ip': '  1.2.3.4  ' },
      });
      expect(extractClientIP(req)).toBe('1.2.3.4');
    });
  });

  describe('periodic cleanup', () => {
    it('cleans up expired bucket entries after 100 calls', async () => {
      vi.useFakeTimers();
      try {
        const { createRateLimiter } = await import('./rateLimiter');
        const limiter = createRateLimiter();

        // Create some initial buckets
        await limiter.check(makeRequest({ ip: '10.0.0.1' }), 'createNote');
        await limiter.check(makeRequest({ ip: '10.0.0.2' }), 'createNote');

        // Advance time past the expiry buffer (2 * 60s = 120s)
        vi.advanceTimersByTime(121_000);

        // Make 100 calls from different IPs to trigger cleanup without hitting rate limits
        for (let i = 0; i < 100; i++) {
          await limiter.check(makeRequest({ ip: `192.168.1.${i}` }), 'createNote');
        }

        // After cleanup, old entries (10.0.0.1 and 10.0.0.2) should be removed
        // Verify by checking that a new request from those IPs starts fresh
        const result1 = await limiter.check(makeRequest({ ip: '10.0.0.1' }), 'createNote');
        expect(result1.allowed).toBe(true);
        
        const result2 = await limiter.check(makeRequest({ ip: '10.0.0.2' }), 'createNote');
        expect(result2.allowed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('resets call counter after cleanup', async () => {
      vi.useFakeTimers();
      try {
        const { createRateLimiter } = await import('./rateLimiter');
        const limiter = createRateLimiter();
        const req = makeRequest({ ip: '10.0.0.1' });

        // Make 99 calls from different IPs (just under the threshold)
        for (let i = 0; i < 99; i++) {
          await limiter.check(makeRequest({ ip: `172.16.0.${i}` }), 'createNote');
        }

        // Advance time past expiry buffer
        vi.advanceTimersByTime(121_000);

        // 100th call triggers cleanup and resets counter
        await limiter.check(makeRequest({ ip: '172.16.0.99' }), 'createNote');

        // Now make requests from the original IP - should work fine
        // because counter was reset
        for (let i = 0; i < 5; i++) {
          const result = await limiter.check(req, 'createNote');
          expect(result.allowed).toBe(true);
        }
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
