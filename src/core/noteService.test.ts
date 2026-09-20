/**
 * Tests for noteService module — Milestone 2
 * Pure business logic, no storage. Tests cover CRUD, security, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MAX_PAYLOAD_BYTES = 100 * 1024; // 100KB

// Minimal NoteStore interface for testing noteService in isolation
interface NoteRecord {
  id: string;
  content: string;
  createdAt: number;
  deleteToken: string;
}

interface MockNoteStore {
  create: (note: NoteRecord) => Promise<void>;
  get: (id: string) => Promise<NoteRecord | null>;
  update: (id: string, content: string) => Promise<boolean>;
  delete: (id: string) => Promise<boolean>;
  exists: (id: string) => Promise<boolean>;
}

function createMockStore(): MockNoteStore & { data: Map<string, NoteRecord> } {
  const data = new Map<string, NoteRecord>();
  return {
    data,
    create: vi.fn(async (note: NoteRecord) => {
      if (data.has(note.id)) throw new Error('COLLISION');
      data.set(note.id, { ...note });
    }),
    get: vi.fn(async (id: string) => data.get(id) ?? null),
    update: vi.fn(async (id: string, content: string) => {
      const existing = data.get(id);
      if (!existing) return false;
      data.set(id, { ...existing, content });
      return true;
    }),
    delete: vi.fn(async (id: string) => data.delete(id)),
    exists: vi.fn(async (id: string) => data.has(id)),
  };
}

describe('noteService', () => {
  let createNote: (
    store: MockNoteStore,
    content: string,
    idGen?: { generateNoteId: () => string; generateDeleteToken: () => string },
    now?: number
  ) => Promise<{ noteId: string; deleteToken: string }>;
  let getNote: (
    store: MockNoteStore,
    id: string,
    now?: number
  ) => Promise<NoteRecord | null>;
  let updateNote: (
    store: MockNoteStore,
    id: string,
    content: string,
    now?: number
  ) => Promise<boolean>;
  let deleteNote: (
    store: MockNoteStore,
    id: string,
    deleteToken: string,
    now?: number
  ) => Promise<boolean>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
    const mod = await import('./noteService');
    createNote = mod.createNote;
    getNote = mod.getNote;
    updateNote = mod.updateNote;
    deleteNote = mod.deleteNote;
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe('createNote()', () => {
    it('creates a note and returns noteId and deleteToken', async () => {
      const store = createMockStore();
      const result = await createNote(store, 'Hello world');
      expect(result).toHaveProperty('noteId');
      expect(result).toHaveProperty('deleteToken');
      expect(typeof result.noteId).toBe('string');
      expect(typeof result.deleteToken).toBe('string');
      expect(result.noteId.length).toBeGreaterThan(0);
      expect(result.deleteToken.length).toBeGreaterThan(0);
    });

    it('stores the note in the store with correct fields', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Test content');
      const stored = store.data.get(noteId);
      expect(stored).toBeDefined();
      expect(stored!.content).toBe('Test content');
      expect(stored!.id).toBe(noteId);
      expect(stored!.createdAt).toBe(Date.now());
      expect(stored!.deleteToken.length).toBeGreaterThan(0);
    });

    it('calls store.create exactly once', async () => {
      const store = createMockStore();
      await createNote(store, 'content');
      expect(store.create).toHaveBeenCalledTimes(1);
    });

    it('rejects content exceeding 100KB payload cap', async () => {
      const store = createMockStore();
      const oversized = 'x'.repeat(MAX_PAYLOAD_BYTES + 1);
      await expect(createNote(store, oversized)).rejects.toThrow();
    });

    it('accepts content at exactly 100KB', async () => {
      const store = createMockStore();
      const exact = 'x'.repeat(MAX_PAYLOAD_BYTES);
      await expect(createNote(store, exact)).resolves.toBeDefined();
    });

    it('accepts empty content', async () => {
      const store = createMockStore();
      await expect(createNote(store, '')).resolves.toBeDefined();
    });

    it('sanitizes HTML tags from content (plain text only)', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, '<script>alert("xss")</script>Hello');
      const stored = store.data.get(noteId);
      expect(stored!.content).not.toContain('<script>');
      expect(stored!.content).not.toContain('</script>');
      expect(stored!.content).not.toContain('<');
      expect(stored!.content).not.toContain('>');
    });

    it('sanitizes various HTML injection attempts', async () => {
      const attacks = [
        '<img src=x onerror=alert(1)>',
        '<a href="javascript:alert(1)">click</a>',
        '<div style="background:url(javascript:alert(1))">',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      ];
      for (const attack of attacks) {
        const s = createMockStore();
        const { noteId } = await createNote(s, attack);
        const stored = s.data.get(noteId);
        expect(stored!.content).not.toMatch(/<[^>]+>/);
      }
    });

    it('propagates store collision errors (fails loudly)', async () => {
      const store = createMockStore();
      store.create = vi.fn(async () => { throw new Error('COLLISION'); });
      await expect(createNote(store, 'content')).rejects.toThrow(/COLLISION/i);
    });
  });

  describe('getNote()', () => {
    it('returns the note when it exists and is not expired', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      const note = await getNote(store, noteId);
      expect(note).toBeDefined();
      expect(note!.content).toBe('Hello');
      expect(note!.id).toBe(noteId);
    });

    it('returns null for a non-existent ID', async () => {
      const store = createMockStore();
      const result = await getNote(store, 'non-existent-id');
      expect(result).toBeNull();
    });

    it('returns null for an expired note (uniform response)', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      // Advance time past 24h
      vi.setSystemTime(new Date('2024-06-02T12:00:01Z'));
      const result = await getNote(store, noteId);
      expect(result).toBeNull();
    });

    it('returns null for expired note — same shape as non-existent (uniform errors)', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      vi.setSystemTime(new Date('2024-06-02T12:00:01Z'));
      const expiredResult = await getNote(store, noteId);
      const missingResult = await getNote(store, 'never-existed');
      // Both must be null — same response shape
      expect(expiredResult).toBeNull();
      expect(missingResult).toBeNull();
    });

    it('returns note just before expiry (23h 59m 59s)', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      vi.setSystemTime(new Date('2024-06-02T11:59:59Z'));
      const result = await getNote(store, noteId);
      expect(result).not.toBeNull();
    });

    it('uses Date.now() when now is omitted', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      vi.setSystemTime(new Date('2024-06-01T13:00:00Z')); // 1h later
      const result = await getNote(store, noteId);
      expect(result).not.toBeNull();
    });
  });

  describe('updateNote()', () => {
    it('updates content of an existing, non-expired note', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Original');
      const result = await updateNote(store, noteId, 'Updated');
      expect(result).toBe(true);
      expect(store.data.get(noteId)!.content).toBe('Updated');
    });
    it('preserves original createdAt after update', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Original');
      const originalCreatedAt = store.data.get(noteId)!.createdAt;
      vi.setSystemTime(new Date('2024-06-01T18:00:00Z'));
      await updateNote(store, noteId, 'Updated');
      expect(store.data.get(noteId)!.createdAt).toBe(originalCreatedAt);
    });
    it('returns false for non-existent note', async () => {
      const store = createMockStore();
      expect(await updateNote(store, 'no-such-id', 'content')).toBe(false);
    });
    it('returns false for expired note', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      vi.setSystemTime(new Date('2024-06-02T12:00:01Z'));
      expect(await updateNote(store, noteId, 'Updated')).toBe(false);
    });
    it('rejects content exceeding 100KB payload cap', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Original');
      const oversized = 'x'.repeat(MAX_PAYLOAD_BYTES + 1);
      await expect(updateNote(store, noteId, oversized)).rejects.toThrow();
    });
    it('accepts content at exactly 100KB', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Original');
      const exact = 'x'.repeat(MAX_PAYLOAD_BYTES);
      await expect(updateNote(store, noteId, exact)).resolves.toBe(true);
    });
    it('sanitizes HTML from updated content', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Original');
      await updateNote(store, noteId, '<b>Bold</b> text');
      const stored = store.data.get(noteId);
      expect(stored!.content).not.toContain('<b>');
      expect(stored!.content).not.toContain('</b>');
    });
  });


  describe('deleteNote()', () => {
    it('deletes note with correct deleteToken', async () => {
      const store = createMockStore();
      const { noteId, deleteToken } = await createNote(store, 'Hello');
      const result = await deleteNote(store, noteId, deleteToken);
      expect(result).toBe(true);
      expect(store.data.has(noteId)).toBe(false);
    });

    it('returns false for wrong deleteToken', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      const result = await deleteNote(store, noteId, 'wrong-token');
      expect(result).toBe(false);
      // Note should still exist
      expect(store.data.has(noteId)).toBe(true);
    });

    it('returns false for non-existent note (uniform with wrong token)', async () => {
      const store = createMockStore();
      const result = await deleteNote(store, 'no-such-id', 'any-token');
      expect(result).toBe(false);
    });

    it('returns false for expired note (uniform response)', async () => {
      const store = createMockStore();
      const { noteId, deleteToken } = await createNote(store, 'Hello');
      vi.setSystemTime(new Date('2024-06-02T12:00:01Z'));
      const result = await deleteNote(store, noteId, deleteToken);
      expect(result).toBe(false);
    });

    it('uniform error: wrong token, expired, and missing all return false', async () => {
      const store = createMockStore();
      const { noteId, deleteToken } = await createNote(store, 'Hello');
      vi.setSystemTime(new Date('2024-06-02T12:00:01Z'));
      // All three failure modes must return the same value (false)
      const wrongToken = await deleteNote(store, noteId, 'wrong');
      const expired = await deleteNote(store, noteId, deleteToken);
      const missing = await deleteNote(store, 'missing', 'token');
      expect(wrongToken).toBe(false);
      expect(expired).toBe(false);
      expect(missing).toBe(false);
    });

    it('rejects empty deleteToken', async () => {
      const store = createMockStore();
      const { noteId } = await createNote(store, 'Hello');
      const result = await deleteNote(store, noteId, '');
      expect(result).toBe(false);
    });
  });


  describe('security: constant-time delete token comparison', () => {
    it('wrong tokens of various lengths all return false (uniform response)', async () => {
      const store = createMockStore();
      const { noteId, deleteToken } = await createNote(store, 'Hello');

      // Test wrong tokens of various lengths - all should return false
      // This verifies uniform error responses regardless of token length/content
      const wrongTokens = [
        'a',
        'ab',
        deleteToken.slice(0, 1), // matches first char only
        deleteToken.slice(0, Math.floor(deleteToken.length / 2)), // matches half
        'x'.repeat(deleteToken.length), // same length, all wrong
        'y'.repeat(deleteToken.length),
        '', // empty
        deleteToken + 'extra', // longer than correct
      ];

      for (const wrongToken of wrongTokens) {
        const result = await deleteNote(store, noteId, wrongToken);
        expect(result).toBe(false);
      }

      // Verify note still exists (wasn't deleted by wrong tokens)
      const note = await getNote(store, noteId);
      expect(note).not.toBeNull();
    });

    it('correct token deletes note exactly once', async () => {
      const store = createMockStore();
      const { noteId, deleteToken } = await createNote(store, 'Hello');

      // First call with correct token should succeed
      const firstDelete = await deleteNote(store, noteId, deleteToken);
      expect(firstDelete).toBe(true);

      // Second call with correct token should fail (note already deleted)
      const secondDelete = await deleteNote(store, noteId, deleteToken);
      expect(secondDelete).toBe(false);

      // Verify note is gone
      const note = await getNote(store, noteId);
      expect(note).toBeNull();
    });

    it('implementation uses constant-time comparison (source code verification)', async () => {
      // Timing tests are unreliable in CI environments.
      // The primary verification is source code inspection (see below).
      // This test documents the requirement and defers to source validation.
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceFile = path.resolve(__dirname, './noteService.ts');
      const source = fs.readFileSync(sourceFile, 'utf-8');

      // Verify constant-time comparison is used
      const usesConstantTime =
        /timingSafeEqual/.test(source) ||
        /constant.?time/i.test(source);
      expect(usesConstantTime).toBe(true);
    });
  });

  describe('security: source code validation', () => {
    it('source does not use early-exit string comparison for delete tokens', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceFile = path.resolve(__dirname, './noteService.ts');
      const source = fs.readFileSync(sourceFile, 'utf-8');

      // Should use crypto.timingSafeEqual or similar constant-time comparison
      const usesConstantTime =
        /crypto\.timingSafeEqual/.test(source) ||
        /timingSafeEqual/.test(source) ||
        /constant.?time/i.test(source);
      expect(usesConstantTime).toBe(true);

      // Should NOT use simple === for token comparison in delete logic
      // This is a heuristic check — the actual implementation should use timingSafeEqual
      const deleteFnMatch = source.match(/deleteNote[\s\S]*?^}/m);
      if (deleteFnMatch) {
        const deleteFn = deleteFnMatch[0];
        // Should not have simple === comparison for tokens
        expect(deleteFn).not.toMatch(/deleteToken\s*===\s*[^=]/);
        expect(deleteFn).not.toMatch(/token\s*===\s*[^=]/);
      }
    });

    it('source does not use Math.random() for ID generation', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceFile = path.resolve(__dirname, './noteService.ts');
      const source = fs.readFileSync(sourceFile, 'utf-8');
      expect(source).not.toMatch(/Math\.random\s*\(/);
    });
  });

  describe('edge cases', () => {
    it('handles unicode content correctly', async () => {
      const store = createMockStore();
      const unicode = '你好世界 🌍 مرحبا';
      const { noteId } = await createNote(store, unicode);
      const note = await getNote(store, noteId);
      expect(note!.content).toBe(unicode);
    });

    it('handles content with newlines and special characters', async () => {
      const store = createMockStore();
      const special = 'Line 1\nLine 2\tTab\r\nCRLF\n\n\nMultiple newlines';
      const { noteId } = await createNote(store, special);
      const note = await getNote(store, noteId);
      expect(note!.content).toBe(special);
    });

    it('handles very long content just under 100KB', async () => {
      const store = createMockStore();
      const long = 'x'.repeat(MAX_PAYLOAD_BYTES - 1);
      const { noteId } = await createNote(store, long);
      const note = await getNote(store, noteId);
      expect(note!.content.length).toBe(MAX_PAYLOAD_BYTES - 1);
    });

    it('multiple creates generate unique IDs', async () => {
      const store = createMockStore();
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { noteId } = await createNote(store, `Note ${i}`);
        ids.add(noteId);
      }
      expect(ids.size).toBe(100);
    });
  });
});


