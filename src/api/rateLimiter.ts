/**
 * Rate limiter — per-IP, per-endpoint rate limiting with configurable limits.
 * Decision 10: Per-IP rate limits with configurable defaults
 *
 * Uses a fixed-window algorithm (60-second windows).
 */
import type { GenericRequest, GenericResponse, Handler } from './types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type Endpoint = 'createNote' | 'getNote' | 'updateNote' | 'deleteNote';

export interface RateLimitConfig {
  createNote: number;
  getNote: number;
  updateNote: number;
  deleteNote: number;
}

export interface RateLimitResult {
  allowed: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface RateLimiter {
  check(req: GenericRequest, endpoint: Endpoint): Promise<RateLimitResult>;
  getLimit(endpoint: Endpoint): number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_LIMITS: RateLimitConfig = {
  createNote: 10,
  getNote: 30,
  updateNote: 60,
  deleteNote: 10,
};

const WINDOW_SIZE_MS = 60_000; // 60 seconds

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseLimit(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function getConfigFromEnv(): RateLimitConfig {
  return {
    createNote: parseLimit(process.env.RATE_LIMIT_CREATE, DEFAULT_LIMITS.createNote),
    getNote: parseLimit(process.env.RATE_LIMIT_READ, DEFAULT_LIMITS.getNote),
    updateNote: parseLimit(process.env.RATE_LIMIT_UPDATE, DEFAULT_LIMITS.updateNote),
    deleteNote: parseLimit(process.env.RATE_LIMIT_DELETE, DEFAULT_LIMITS.deleteNote),
  };
}

// ── IP Extraction ──────────────────────────────────────────────────────────────

/**
 * Securely extracts the client IP from a request.
 * Priority: CF-Connecting-IP (Cloudflare-set, trusted) → x-forwarded-for (first IP) → x-real-ip → req.ip → 'unknown'
 * 
 * CRITICAL: CF-Connecting-IP is set by Cloudflare's edge proxy and cannot be spoofed by clients.
 * X-Forwarded-For and X-Real-IP can be spoofed unless behind a trusted proxy.
 */
export function extractClientIP(req: GenericRequest): string {
  // CF-Connecting-IP: Set by Cloudflare edge, cannot be spoofed by client
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP && cfIP.trim().length > 0) {
    return cfIP.trim();
  }

  // x-forwarded-for: take first IP only (prevents spoofing via multiple entries)
  // WARNING: Can be spoofed unless behind a trusted proxy
  const xff = req.headers['x-forwarded-for'];
  if (xff && xff.trim().length > 0) {
    const firstIp = xff.split(',')[0].trim();
    if (firstIp.length > 0) {
      return firstIp;
    }
  }

  // x-real-ip header
  // WARNING: Can be spoofed unless behind a trusted proxy
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp && xRealIp.trim().length > 0) {
    return xRealIp.trim();
  }

  // Fallback to req.ip (set by some platform adapters)
  const ip = (req as GenericRequest & { ip?: string }).ip;
  if (ip !== undefined && ip !== null && ip.length > 0) {
    return ip;
  }

  return 'unknown';
}

// ── Rate Limiter Factory ───────────────────────────────────────────────────────

interface BucketEntry {
  count: number;
  windowStart: number;
}

// Cleanup configuration
const CLEANUP_INTERVAL_CALLS = 100; // Run cleanup every 100 check() calls
const EXPIRY_BUFFER_MS = WINDOW_SIZE_MS * 2; // Remove entries older than 2 windows

export function createRateLimiter(): RateLimiter {
  const config = getConfigFromEnv();
  const buckets = new Map<string, BucketEntry>();
  let callCount = 0;

  function getBucketKey(ip: string, endpoint: Endpoint): string {
    return `${ip}::${endpoint}`;
  }

  /**
   * Cleans up expired bucket entries to prevent unbounded memory growth.
   * Called periodically (every CLEANUP_INTERVAL_CALLS check() calls).
   */
  function cleanupExpiredBuckets(now: number): void {
    for (const [key, entry] of buckets.entries()) {
      if ((now - entry.windowStart) >= EXPIRY_BUFFER_MS) {
        buckets.delete(key);
      }
    }
  }

  return {
    check(req: GenericRequest, endpoint: Endpoint): Promise<RateLimitResult> {
      const ip = extractClientIP(req);
      const key = getBucketKey(ip, endpoint);
      const now = Date.now();
      const limit = config[endpoint];

      // Periodic cleanup to prevent memory leak
      callCount++;
      if (callCount >= CLEANUP_INTERVAL_CALLS) {
        cleanupExpiredBuckets(now);
        callCount = 0;
      }

      let entry = buckets.get(key);

      // New window or expired window
      if (!entry || (now - entry.windowStart) >= WINDOW_SIZE_MS) {
        entry = { count: 1, windowStart: now };
        buckets.set(key, entry);
        return Promise.resolve({ allowed: true });
      }

      // Within limit
      if (entry.count < limit) {
        entry.count++;
        return Promise.resolve({ allowed: true });
      }

      // Rate limited — calculate Retry-After
      const elapsed = now - entry.windowStart;
      const retryAfter = Math.max(1, Math.ceil((WINDOW_SIZE_MS - elapsed) / 1000));

      return Promise.resolve({
        allowed: false,
        status: 429,
        headers: {
          'retry-after': String(retryAfter),
          'content-type': 'application/json',
        },
        body: { error: 'Rate limit exceeded' },
      });
    },

    getLimit(endpoint: Endpoint): number {
      return config[endpoint];
    },
  };
}

// ── Handler Wrapper ────────────────────────────────────────────────────────────

/**
 * Wraps a handler with rate limiting.
 * Returns 429 when limit exceeded, otherwise delegates to the handler.
 */
export function withRateLimit(
  handler: Handler,
  limiter: RateLimiter,
  endpoint: Endpoint
): Handler {
  return async (req: GenericRequest): Promise<GenericResponse> => {
    const result = await limiter.check(req, endpoint);

    if (!result.allowed) {
      return {
        status: result.status!,
        body: result.body!,
        headers: result.headers!,
      };
    }

    return handler(req);
  };
}
