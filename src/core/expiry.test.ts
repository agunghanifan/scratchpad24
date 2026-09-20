/**
 * Tests for expiry module — Milestone 2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;
const TWENTY_FOUR_H = 24 * MS_PER_HOUR;

describe('expiry', () => {
  let calculateExpiry: (createdAt: number) => number;
  let isExpired: (createdAt: number, now?: number) => boolean;
  let timeRemaining: (createdAt: number, now?: number) => number;
  let formatTimeRemaining: (createdAt: number, now?: number) => string;

  beforeEach(async () => {
    vi.useFakeTimers();
    const mod = await import('./expiry');
    calculateExpiry = mod.calculateExpiry;
    isExpired = mod.isExpired;
    timeRemaining = mod.timeRemaining;
    formatTimeRemaining = mod.formatTimeRemaining;
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe('calculateExpiry()', () => {
    it('returns createdAt + 24 hours in milliseconds', () => {
      expect(calculateExpiry(1_700_000_000_000)).toBe(1_700_000_000_000 + TWENTY_FOUR_H);
    });
    it('works for createdAt = 0', () => {
      expect(calculateExpiry(0)).toBe(TWENTY_FOUR_H);
    });
    it('is deterministic (pure function)', () => {
      const ct = Date.now();
      expect(calculateExpiry(ct)).toBe(calculateExpiry(ct));
    });
    it('expiry is fixed — no extension possible', () => {
      const ct = Date.now();
      const results = new Set<number>();
      for (let i = 0; i < 100; i++) results.add(calculateExpiry(ct));
      expect(results.size).toBe(1);
    });
  });

  describe('isExpired()', () => {
    it('returns false when now < createdAt + 24h', () => {
      const ct = 1_700_000_000_000;
      expect(isExpired(ct, ct + 23 * MS_PER_HOUR)).toBe(false);
    });
    it('returns true at exact expiry boundary (>=)', () => {
      const ct = 1_700_000_000_000;
      expect(isExpired(ct, ct + TWENTY_FOUR_H)).toBe(true);
    });
    it('returns true when now > createdAt + 24h', () => {
      const ct = 1_700_000_000_000;
      expect(isExpired(ct, ct + TWENTY_FOUR_H + 1)).toBe(true);
    });
    it('returns false immediately after creation', () => {
      const ct = Date.now();
      expect(isExpired(ct, ct)).toBe(false);
    });
    it('uses Date.now() when now is omitted (expired)', () => {
      vi.setSystemTime(new Date('2024-01-02T01:00:00Z'));
      const ct = new Date('2024-01-01T00:00:00Z').getTime();
      expect(isExpired(ct)).toBe(true);
    });
    it('uses Date.now() when now is omitted (not expired)', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const ct = new Date('2024-01-01T00:00:00Z').getTime();
      expect(isExpired(ct)).toBe(false);
    });
  });

  describe('timeRemaining()', () => {
    it('returns 24h in ms when called at creation time', () => {
      const ct = 1_700_000_000_000;
      expect(timeRemaining(ct, ct)).toBe(TWENTY_FOUR_H);
    });
    it('returns 1h remaining when 23h have passed', () => {
      const ct = 1_700_000_000_000;
      expect(timeRemaining(ct, ct + 23 * MS_PER_HOUR)).toBe(MS_PER_HOUR);
    });
    it('returns 0 when expired', () => {
      const ct = 1_700_000_000_000;
      expect(timeRemaining(ct, ct + TWENTY_FOUR_H + 5000)).toBe(0);
    });
    it('returns 0 at exact expiry boundary', () => {
      const ct = 1_700_000_000_000;
      expect(timeRemaining(ct, ct + TWENTY_FOUR_H)).toBe(0);
    });
    it('never returns negative values', () => {
      const ct = 1_700_000_000_000;
      expect(timeRemaining(ct, ct + 100 * TWENTY_FOUR_H)).toBeGreaterThanOrEqual(0);
    });
    it('uses Date.now() when now is omitted', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const ct = new Date('2024-01-01T00:00:00Z').getTime();
      expect(timeRemaining(ct)).toBe(12 * MS_PER_HOUR);
    });
  });

  describe('formatTimeRemaining()', () => {
    it('formats hours and minutes (e.g., "23h 12m")', () => {
      const ct = 1_700_000_000_000;
      const now = ct + 48 * MS_PER_MIN; // 48min elapsed => 23h 12m left
      expect(formatTimeRemaining(ct, now)).toMatch(/23h\s*12m/);
    });
    it('shows expired/0m when time is up', () => {
      const ct = 1_700_000_000_000;
      const r = formatTimeRemaining(ct, ct + TWENTY_FOUR_H + 1);
      expect(r.toLowerCase()).toMatch(/expired|0m|0h/);
    });
    it('shows "24h" at creation', () => {
      const ct = 1_700_000_000_000;
      expect(formatTimeRemaining(ct, ct)).toMatch(/24h/);
    });
    it('shows only minutes when less than 1 hour remaining', () => {
      const ct = 1_700_000_000_000;
      const now = ct + 23 * MS_PER_HOUR + 30 * MS_PER_MIN;
      expect(formatTimeRemaining(ct, now)).toMatch(/30m/);
    });
    it('uses Date.now() when now is omitted', () => {
      vi.setSystemTime(new Date('2024-01-01T06:00:00Z'));
      const ct = new Date('2024-01-01T00:00:00Z').getTime();
      expect(formatTimeRemaining(ct)).toMatch(/18h/);
    });
  });

  describe('no expiry extension (security)', () => {
    it('module does not export any extend/renew/prolong function', async () => {
      const mod = await import('./expiry');
      const extendFns = Object.keys(mod).filter(
        (k) => /extend|renew|prolong|refresh/i.test(k)
      );
      expect(extendFns.length).toBe(0);
    });
    it('calculateExpiry is independent of current time', () => {
      const ct = 1_700_000_000_000;
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const a = calculateExpiry(ct);
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
      expect(calculateExpiry(ct)).toBe(a);
    });
  });
});
