/**
 * Tests for KvNoteStore — Milestone 7: Cloudflare KV Storage
 *
 * These tests verify the KvNoteStore implementation that uses Cloudflare KV
 * as the backing store. KV provides built-in TTL (expiration) so we rely on
 * that for 24-hour note expiry.
 *
 * Tests mock the KVNamespace binding and verify:
 * - CRUD operations map correctly to KV get/put/delete
 * - 24h TTL is set via KV's expirationTtl option
 * - Collision handling (duplicate ID rejection)
 * - Defensive copies (no mutation of caller objects)
 * - Error handling when KV operations fail
 * - exists() uses KV get (not list) for efficiency
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KvNoteStore } from './KvNoteStore';
import type { NoteRecord } from './NoteStore';

// Cloudflare KVNamespace-like mock
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

function createTestNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: 'test-id-123',
    content: 'Test content',
    createdAt: Date.now(),
    deleteToken: 'test-delete-token',
    ...overrides,
  };
}

const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60;

describe('KvNoteStore', () => {
  let kv: KvMock;
  let store: InstanceType<typeof KvNoteStore>;

  beforeEach(() => {
    kv = createKvMock();
    store = new KvNoteStore(kv as unknown as ConstructorParameters<typeof KvNoteStore>[0]);
  });

  describe('constructor', () => {
    it('accepts a KVNamespace-like binding', () => {
      expect(store).toBeDefined();
    });

    it('throws if KV binding is missing', () => {
      expect(() => new KvNoteStore(null as unknown as ConstructorParameters<typeof KvNoteStore>[0])).toThrow();
    });
  });

  describe('create()', () => {
    it('stores note in KV with the note ID as key', async () => {
      const note = createTestNote({ id: 'abc-123' });
      await store.create(note);

      expect(kv.put).toHaveBeenCalledTimes(1);
      expect(kv.put).toHaveBeenCalledWith(
        'abc-123',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('stores note as JSON containing all NoteRecord fields', async () => {
      const note = createTestNote({
        id: 'json-test',
        content: 'Hello world',
        createdAt: 1700000000000,
        deleteToken: 'secret-token',
      });
      await store.create(note);

      const storedValue = kv._store.get('json-test')!.value;
      const parsed = JSON.parse(storedValue);
      expect(parsed).toEqual({
        id: 'json-test',
        content: 'Hello world',
        createdAt: 1700000000000,
        deleteToken: 'secret-token',
      });
    });

    it('sets 24-hour TTL via KV expirationTtl option', async () => {
      const note = createTestNote();
      await store.create(note);

      expect(kv.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: TWENTY_FOUR_HOURS_SECONDS }),
      );
    });

    it('rejects duplicate ID (collision handling)', async () => {
      const note1 = createTestNote({ id: 'dup-id' });
      const note2 = createTestNote({ id: 'dup-id', content: 'Other' });
      await store.create(note1);
      await expect(store.create(note2)).rejects.toThrow();
    });

    it('duplicate-ID error message mentions collision/duplicate/exists', async () => {
      const note1 = createTestNote({ id: 'dup-2' });
      const note2 = createTestNote({ id: 'dup-2' });
      await store.create(note1);
      try {
        await store.create(note2);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as Error).message).toMatch(/duplicate|collision|exists/i);
      }
    });

    it('does not call KV.put when duplicate ID is detected', async () => {
      const note1 = createTestNote({ id: 'dup-3' });
      const note2 = createTestNote({ id: 'dup-3' });
      await store.create(note1);
      kv.put.mockClear();
      try { await store.create(note2); } catch { /* expected */ }
      expect(kv.put).not.toHaveBeenCalled();
    });

    it('does not mutate the original note object', async () => {
      const original = createTestNote();
      const snapshot = { ...original };
      await store.create(original);
      expect(original).toEqual(snapshot);
    });

    it('stores a deep copy — later mutation of input does not affect stored value', async () => {
      const note = createTestNote({ id: 'copy-test' });
      await store.create(note);
      note.content = 'MUTATED';
      const raw = kv._store.get('copy-test')!.value;
      const parsed = JSON.parse(raw);
      expect(parsed.content).toBe('Test content');
    });

    it('propagates KV put errors', async () => {
      kv.put.mockRejectedValueOnce(new Error('KV write failed'));
      await expect(store.create(createTestNote())).rejects.toThrow('KV write failed');
    });

    it('propagates KV get errors during collision check', async () => {
      kv.get.mockRejectedValueOnce(new Error('KV read failed'));
      await expect(store.create(createTestNote())).rejects.toThrow('KV read failed');
    });

  describe('get()', () => {
    it('retrieves and parses a stored note', async () => {
      const note = createTestNote({
        id: 'get-test',
        content: 'Stored content',
        createdAt: 1234567890,
        deleteToken: 'tok',
      });
      await store.create(note);

      const retrieved = await store.get('get-test');
      expect(retrieved).toEqual({
        id: 'get-test',
        content: 'Stored content',
        createdAt: 1234567890,
        deleteToken: 'tok',
      });
    });

    it('returns null for non-existent note', async () => {
      const result = await store.get('never-existed');
      expect(result).toBeNull();
    });

    it('returns null when KV returns null (expired / evicted)', async () => {
      const result = await store.get('expired-key');
      expect(result).toBeNull();
    });

    it('returns a defensive copy — mutating result does not affect stored value', async () => {
      const note = createTestNote({ id: 'immutable' });
      await store.create(note);
      const first = await store.get('immutable');
      first!.content = 'Mutated!';
      const second = await store.get('immutable');
      expect(second!.content).toBe('Test content');
    });

    it('returns null when stored value is malformed JSON (defensive)', async () => {
      kv._store.set('corrupt', { value: 'not-json{' });
      const result = await store.get('corrupt');
      expect(result).toBeNull();
    });

    it('propagates KV get errors', async () => {
      kv.get.mockRejectedValueOnce(new Error('KV read failed'));
      await expect(store.get('any')).rejects.toThrow('KV read failed');
    });
  });

  });

  describe('update()', () => {
    it('updates content of existing note', async () => {
      const note = createTestNote({ id: 'upd-1', content: 'old' });
      await store.create(note);
      const ok = await store.update('upd-1', 'new');
      expect(ok).toBe(true);
      const retrieved = await store.get('upd-1');
      expect(retrieved!.content).toBe('new');
    });

    it('preserves other fields when updating', async () => {
      const note = createTestNote({
        id: 'upd-2',
        content: 'old',
        createdAt: 111,
        deleteToken: 'tok',
      });
      await store.create(note);
      await store.update('upd-2', 'new');
      const retrieved = await store.get('upd-2');
      expect(retrieved).toEqual({
        id: 'upd-2',
        content: 'new',
        createdAt: 111,
        deleteToken: 'tok',
      });
    });

    it('returns false for non-existent note', async () => {
      const ok = await store.update('missing', 'content');
      expect(ok).toBe(false);
    });

    it('does not call KV.put when note does not exist', async () => {
      kv.put.mockClear();
      const ok = await store.update('missing', 'content');
      expect(ok).toBe(false);
      const putCallsForMissing = kv.put.mock.calls.filter(([key]) => key === 'missing');
      expect(putCallsForMissing.length).toBe(0);
    });

    it('preserves the original TTL on update (re-sets 24h)', async () => {
      const note = createTestNote({ id: 'upd-ttl' });
      await store.create(note);
      kv.put.mockClear();
      await store.update('upd-ttl', 'refreshed');
      expect(kv.put).toHaveBeenCalledWith(
        'upd-ttl',
        expect.any(String),
        expect.objectContaining({ expirationTtl: TWENTY_FOUR_HOURS_SECONDS }),
      );
    });

    it('propagates KV errors during update', async () => {
      const note = createTestNote({ id: 'upd-err' });
      await store.create(note);
      kv.put.mockRejectedValueOnce(new Error('KV write failed'));
      await expect(store.update('upd-err', 'x')).rejects.toThrow('KV write failed');
    });
  });



  describe('delete()', () => {
    it('removes note from KV and returns true', async () => {
      const note = createTestNote({ id: 'del-1' });
      await store.create(note);
      const ok = await store.delete('del-1');
      expect(ok).toBe(true);
      expect(kv.delete).toHaveBeenCalledWith('del-1');
      const retrieved = await store.get('del-1');
      expect(retrieved).toBeNull();
    });

    it('returns false for non-existent note', async () => {
      const ok = await store.delete('missing');
      expect(ok).toBe(false);
    });

    it('propagates KV delete errors', async () => {
      kv.delete.mockRejectedValueOnce(new Error('KV delete failed'));
      await expect(store.delete('any')).rejects.toThrow('KV delete failed');
    });
  });

  describe('exists()', () => {
    it('returns true when note exists', async () => {
      const note = createTestNote({ id: 'ex-1' });
      await store.create(note);
      const result = await store.exists('ex-1');
      expect(result).toBe(true);
    });

    it('returns false when note does not exist', async () => {
      const result = await store.exists('missing');
      expect(result).toBe(false);
    });

    it('returns false for expired note (KV returns null)', async () => {
      const result = await store.exists('expired');
      expect(result).toBe(false);
    });

    it('propagates KV errors', async () => {
      kv.get.mockRejectedValueOnce(new Error('KV read failed'));
      await expect(store.exists('any')).rejects.toThrow('KV read failed');
    });
  });

  describe('interface compliance', () => {
    it('implements NoteStore interface methods', () => {
      expect(typeof store.create).toBe('function');
      expect(typeof store.get).toBe('function');
      expect(typeof store.update).toBe('function');
      expect(typeof store.delete).toBe('function');
    });

    it('create returns Promise<void>', async () => {
      const result = store.create(createTestNote());
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('get returns Promise<NoteRecord | null>', async () => {
      const result = store.get('any');
      expect(result).toBeInstanceOf(Promise);
      const value = await result;
      expect(value === null || typeof value === 'object').toBe(true);
    });

    it('update returns Promise<boolean>', async () => {
      const result = store.update('any', 'content');
      expect(result).toBeInstanceOf(Promise);
      expect(typeof (await result)).toBe('boolean');
    });

    it('delete returns Promise<boolean>', async () => {
      const result = store.delete('any');
      expect(result).toBeInstanceOf(Promise);
      expect(typeof (await result)).toBe('boolean');
    });

    it('exists returns Promise<boolean>', async () => {
      const result = store.exists('any');
      expect(result).toBeInstanceOf(Promise);
      expect(typeof (await result)).toBe('boolean');
    });
  });
});
