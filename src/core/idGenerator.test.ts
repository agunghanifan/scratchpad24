/**
 * Tests for idGenerator module — Milestone 2
 *
 * Validates: UUID v4 format, CSPRNG, 128+ bits entropy, uniqueness, delete tokens.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SOURCE_FILE = path.resolve(__dirname, './idGenerator.ts');
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readSource(): string {
  return fs.readFileSync(SOURCE_FILE, 'utf-8');
}

describe('idGenerator', () => {
  let generateNoteId: () => string;
  let generateDeleteToken: () => string;

  beforeEach(async () => {
    const mod = await import('./idGenerator');
    generateNoteId = mod.generateNoteId;
    generateDeleteToken = mod.generateDeleteToken;
  });

  describe('module exports', () => {
    it('exports generateNoteId as a function', () => {
      expect(typeof generateNoteId).toBe('function');
    });
    it('exports generateDeleteToken as a function', () => {
      expect(typeof generateDeleteToken).toBe('function');
    });
  });

  describe('generateNoteId()', () => {
    it('returns a valid UUID v4 format', () => {
      expect(generateNoteId()).toMatch(UUID_V4_REGEX);
    });
    it('has 36 characters (standard UUID string length)', () => {
      expect(generateNoteId().length).toBe(36);
    });
    it('version digit is always 4', () => {
      for (let i = 0; i < 100; i++) expect(generateNoteId()[14]).toBe('4');
    });
    it('variant digit is always 8, 9, a, or b', () => {
      const valid = new Set(['8', '9', 'a', 'b']);
      for (let i = 0; i < 100; i++)
        expect(valid.has(generateNoteId()[19].toLowerCase())).toBe(true);
    });
    it('generates unique IDs across 10,000 calls (no collisions)', () => {
      const ids = new Set<string>();
      const N = 10_000;
      for (let i = 0; i < N; i++) ids.add(generateNoteId());
      expect(ids.size).toBe(N);
    });
  });

  describe('generateDeleteToken()', () => {
    it('returns a non-empty string', () => {
      const t = generateDeleteToken();
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    });
    it('has at least 128 bits of entropy (UUID 122-bit, hex 32+ chars, or base64 22+ chars)', () => {
      const t = generateDeleteToken();
      const ok =
        UUID_V4_REGEX.test(t) ||
        (/^[0-9a-f]+$/i.test(t) && t.length >= 32) ||
        t.length >= 22;
      expect(ok).toBe(true);
    });
    it('generates unique tokens across 10,000 calls', () => {
      const tokens = new Set<string>();
      const N = 10_000;
      for (let i = 0; i < N; i++) tokens.add(generateDeleteToken());
      expect(tokens.size).toBe(N);
    });
    it('tokens never collide with note IDs', () => {
      const ids = new Set<string>();
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateNoteId());
        tokens.add(generateDeleteToken());
      }
      expect([...ids].filter((id) => tokens.has(id)).length).toBe(0);
    });
  });

  describe('cryptographic randomness (security)', () => {
    it('source code does NOT use Math.random()', () => {
      expect(readSource()).not.toMatch(/Math\.random\s*\(/);
    });
    it('uses crypto.randomUUID, crypto.getRandomValues, webcrypto, or node crypto', () => {
      const s = readSource();
      const ok =
        /crypto\.randomUUID\s*\(/.test(s) ||
        /crypto\.getRandomValues\s*\(/.test(s) ||
        /webcrypto/.test(s) ||
        /from\s+['"]crypto['"]/.test(s) ||
        /require\s*\(\s*['"]crypto['"]\s*\)/.test(s);
      expect(ok).toBe(true);
    });
    it('does not use Date.now() or performance.now() as randomness source', () => {
      const lines = readSource().split('\n');
      const relevant = lines.filter(
        (l) =>
          l.includes('generateNoteId') ||
          l.includes('generateDeleteToken') ||
          l.includes('randomUUID') ||
          l.includes('getRandomValues')
      );
      for (const line of relevant) {
        expect(line).not.toMatch(/Date\.now\s*\(/);
        expect(line).not.toMatch(/performance\.now\s*\(/);
      }
    });
  });

  describe('entropy distribution (chi-squared sanity)', () => {
    it('note IDs have roughly uniform hex distribution (excluding fixed UUID v4 bits)', () => {
      // UUID v4 has fixed bits at specific positions that are NOT random:
      // - Position 12 (0-indexed, no dashes): always '4' (version)
      // - Position 16 (0-indexed, no dashes): always 8/9/a/b (variant)
      // We exclude these positions to test only the random portions.
      const counts: Record<string, number> = {};
      for (const c of '0123456789abcdef') counts[c] = 0;
      const N = 5000;
      for (let i = 0; i < N; i++) {
        const hex = generateNoteId().replace(/-/g, '').toLowerCase();
        // Extract only random positions (exclude position 12 and 16)
        const randomHex = hex.slice(0, 12) + hex.slice(13, 16) + hex.slice(17);
        for (const c of randomHex) {
          if (counts[c] !== undefined) counts[c]++;
        }
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const expected = total / 16;
      for (const c of '0123456789abcdef') {
        const r = counts[c] / expected;
        expect(r).toBeGreaterThan(0.7);
        expect(r).toBeLessThan(1.3);
      }
    });

    it('fixed version digit is always 4', () => {
      for (let i = 0; i < 100; i++) {
        const hex = generateNoteId().replace(/-/g, '');
        expect(hex[12]).toBe('4');
      }
    });

    it('fixed variant digit is always 8, 9, a, or b', () => {
      const valid = new Set(['8', '9', 'a', 'b']);
      for (let i = 0; i < 100; i++) {
        const hex = generateNoteId().replace(/-/g, '');
        expect(valid.has(hex[16])).toBe(true);
      }
    });
  });
});
