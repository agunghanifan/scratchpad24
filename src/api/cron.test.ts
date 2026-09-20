/**
 * Tests for Cron Trigger Cleanup — Milestone 7: Cloudflare Cron Trigger
 *
 * The cron trigger provides a safety net for cleaning up expired notes.
 * While KV handles TTL automatically, the cron trigger can:
 * - Provide metrics/logging on cleanup operations
 * - Handle edge cases where KV TTL might not be immediate
 * - Return count of deleted notes for monitoring
 *
 * Tests verify:
 * - Handler accepts env with KV binding
 * - Returns count of deleted notes
 * - Handles errors gracefully
 * - Idempotent (safe to run multiple times)
 * - Works with empty store
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanupExpired } from './cron';

// Mock KV binding with list() support for scanning all keys
function createKvMock() {
  const store = new Map<string, { value: string; expirationTtl?: number }>();
  return {
    _store: store,
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      return entry ? entry.value : null;
    }),
    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(key, { value, expirationTtl: options?.expirationTtl });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({
      keys: Array.from(store.keys()).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    })),
  };
}

type KvMock = ReturnType<typeof createKvMock>;

describe('Cron Trigger - cleanupExpired', () => {
  let kv: KvMock;
  let env: { NOTES_KV: KvMock };

  beforeEach(() => {
    kv = createKvMock();
    env = { NOTES_KV: kv };
  });

  describe('handler signature', () => {
    it('exports cleanupExpired function', () => {
      expect(typeof cleanupExpired).toBe('function');
    });

    it('accepts env object with NOTES_KV binding', async () => {
      const result = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(typeof result).toBe('number');
    });

    it('returns a Promise<number>', async () => {
      const result = cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(result).toBeInstanceOf(Promise);
      const value = await result;
      expect(typeof value).toBe('number');
    });
  });

  describe('cleanup behavior', () => {
    it('returns 0 when store is empty', async () => {
      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(0);
    });

    it('returns 0 when no notes are expired', async () => {
      const note = {
        id: 'fresh-note',
        content: 'Fresh content',
        createdAt: Date.now(),
        deleteToken: 'token',
      };
      await kv.put('fresh-note', JSON.stringify(note), { expirationTtl: 86400 });

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(0);
    });

    it('identifies and deletes expired notes', async () => {
      const expiredNote = {
        id: 'expired-note',
        content: 'Old content',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('expired-note', JSON.stringify(expiredNote));

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(1);
      expect(kv.delete).toHaveBeenCalledWith('expired-note');
    });

    it('returns count of deleted notes', async () => {
      for (let i = 0; i < 3; i++) {
        const note = {
          id: `expired-${i}`,
          content: `Content ${i}`,
          createdAt: Date.now() - 25 * 60 * 60 * 1000,
          deleteToken: 'token',
        };
        await kv.put(`expired-${i}`, JSON.stringify(note));
      }

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(3);
    });

    it('does not delete non-expired notes', async () => {
      const freshNote = {
        id: 'fresh',
        content: 'Fresh',
        createdAt: Date.now() - 1 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('fresh', JSON.stringify(freshNote));

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(0);
      expect(kv.delete).not.toHaveBeenCalled();
    });

    it('handles mix of expired and non-expired notes', async () => {
      const expired = {
        id: 'expired',
        content: 'Old',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      const fresh = {
        id: 'fresh',
        content: 'New',
        createdAt: Date.now() - 1 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('expired', JSON.stringify(expired));
      await kv.put('fresh', JSON.stringify(fresh));

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(1);
      expect(kv.delete).toHaveBeenCalledWith('expired');
      expect(kv.delete).not.toHaveBeenCalledWith('fresh');
    });

  describe('idempotency', () => {
    it('is safe to run multiple times', async () => {
      const expired = {
        id: 'expired',
        content: 'Old',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('expired', JSON.stringify(expired));

      const count1 = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count1).toBe(1);

      const count2 = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count2).toBe(0);
    });

    it('returns 0 on subsequent runs with no expired notes', async () => {
      await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(0);
    });
  });

  describe('error handling', () => {
    it('handles KV list errors gracefully', async () => {
      kv.list.mockRejectedValueOnce(new Error('KV list failed'));
      await expect(cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0])).rejects.toThrow('KV list failed');
    });

    it('handles KV get errors gracefully', async () => {
      const note = {
        id: 'test',
        content: 'Content',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('test', JSON.stringify(note));
      kv.get.mockRejectedValueOnce(new Error('KV get failed'));

      await expect(cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0])).rejects.toThrow('KV get failed');
    });

    it('handles KV delete errors gracefully', async () => {
      const note = {
        id: 'test',
        content: 'Content',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('test', JSON.stringify(note));
      kv.delete.mockRejectedValueOnce(new Error('KV delete failed'));

      await expect(cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0])).rejects.toThrow('KV delete failed');
    });

    it('handles malformed JSON in stored notes', async () => {
      kv._store.set('corrupt', { value: 'not-json{' });
      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(typeof count).toBe('number');
    });
  });

  describe('edge cases', () => {
    it('handles notes at exact 24-hour boundary', async () => {
      const boundary = {
        id: 'boundary',
        content: 'Boundary',
        createdAt: Date.now() - 24 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('boundary', JSON.stringify(boundary));

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(1);
    });

    it('handles notes just under 24 hours', async () => {
      const almostExpired = {
        id: 'almost',
        content: 'Almost',
        createdAt: Date.now() - (24 * 60 * 60 * 1000 - 1000),
        deleteToken: 'token',
      };
      await kv.put('almost', JSON.stringify(almostExpired));

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(0);
    });

    it('handles empty note content', async () => {
      const empty = {
        id: 'empty',
        content: '',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('empty', JSON.stringify(empty));

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(1);
    });

    it('handles notes with special characters in content', async () => {
      const special = {
        id: 'special',
        content: 'Special chars: !@#$%^&*()<>?{}[]|\\',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
        deleteToken: 'token',
      };
      await kv.put('special', JSON.stringify(special));

      const count = await cleanupExpired(env as unknown as Parameters<typeof cleanupExpired>[0]);
      expect(count).toBe(1);
    });
  });
});

  });
