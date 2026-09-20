/**
 * Tests for InMemoryNoteStore — Milestone 3: Storage Layer
 * 
 * Tests cover:
 * - CRUD operations (create, get, update, delete)
 * - Additional methods (exists, cleanupExpired)
 * - Edge cases: empty store, multiple notes, concurrent operations
 * - Data integrity: no mutation of original objects
 * - Security: collision handling (duplicate IDs)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryNoteStore } from './InMemoryNoteStore';
import type { NoteRecord } from './NoteStore';

function createTestNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: 'test-id-123',
    content: 'Test content',
    createdAt: Date.now(),
    deleteToken: 'test-delete-token',
    ...overrides,
  };
}

describe('InMemoryNoteStore', () => {
  let store: InMemoryNoteStore;

  beforeEach(() => {
    store = new InMemoryNoteStore();
  });

  describe('create()', () => {
    it('stores a note successfully', async () => {
      const note = createTestNote();
      await store.create(note);
      
      const retrieved = await store.get(note.id);
      expect(retrieved).toBeDefined();
      expect(retrieved).not.toBeNull();
    });

    it('stores note with correct data', async () => {
      const note = createTestNote({
        id: 'unique-id',
        content: 'Hello world',
        createdAt: 1234567890,
        deleteToken: 'secret-token',
      });
      
      await store.create(note);
      const retrieved = await store.get('unique-id');
      
      expect(retrieved).toEqual({
        id: 'unique-id',
        content: 'Hello world',
        createdAt: 1234567890,
        deleteToken: 'secret-token',
      });
    });

    it('throws error on duplicate ID (collision handling)', async () => {
      const note1 = createTestNote({ id: 'duplicate-id' });
      const note2 = createTestNote({ id: 'duplicate-id', content: 'Different content' });
      
      await store.create(note1);
      
      await expect(store.create(note2)).rejects.toThrow();
    });

    it('throws specific error message for duplicate ID', async () => {
      const note1 = createTestNote({ id: 'collision-test' });
      const note2 = createTestNote({ id: 'collision-test' });
      
      await store.create(note1);
      
      try {
        await store.create(note2);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/duplicate|collision|exists/i);
      }
    });

    it('does not mutate the original note object', async () => {
      const original = createTestNote();
      const originalCopy = { ...original };
      
      await store.create(original);
      
      // Verify original object was not mutated
      expect(original).toEqual(originalCopy);
    });

    it('stores a deep copy, not a reference', async () => {
      const note = createTestNote();
      await store.create(note);
      
      // Mutate the original object after storage
      note.content = 'Mutated content';
      
      const retrieved = await store.get(note.id);
      expect(retrieved!.content).toBe('Test content'); // Should be original, not mutated
    });

    it('can store multiple notes with different IDs', async () => {
      const note1 = createTestNote({ id: 'id-1', content: 'First' });
      const note2 = createTestNote({ id: 'id-2', content: 'Second' });
      const note3 = createTestNote({ id: 'id-3', content: 'Third' });
      
      await store.create(note1);
      await store.create(note2);
      await store.create(note3);
      
      const retrieved1 = await store.get('id-1');
      const retrieved2 = await store.get('id-2');
      const retrieved3 = await store.get('id-3');
      
      expect(retrieved1!.content).toBe('First');
      expect(retrieved2!.content).toBe('Second');

  describe('get()', () => {
    it('retrieves a stored note by ID', async () => {
      const note = createTestNote({ id: 'get-test' });
      await store.create(note);
      
      const retrieved = await store.get('get-test');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('get-test');
    });

    it('returns null for non-existent ID', async () => {
      const retrieved = await store.get('does-not-exist');
      expect(retrieved).toBeNull();
    });

    it('returns null for empty string ID', async () => {
      const retrieved = await store.get('');
      expect(retrieved).toBeNull();
    });

    it('returns a copy, not a reference to internal storage', async () => {
      const note = createTestNote({ id: 'copy-test' });
      await store.create(note);
      
      const retrieved1 = await store.get('copy-test');
      retrieved1!.content = 'Mutated';
      
      const retrieved2 = await store.get('copy-test');
      expect(retrieved2!.content).toBe('Test content'); // Should not be mutated
    });

    it('retrieves correct note when multiple notes exist', async () => {
      const note1 = createTestNote({ id: 'note-1', content: 'First' });
      const note2 = createTestNote({ id: 'note-2', content: 'Second' });
      
      await store.create(note1);
      await store.create(note2);
      
      const retrieved = await store.get('note-2');
      expect(retrieved!.content).toBe('Second');
    });
  });

  describe('update()', () => {
    it('updates content of existing note', async () => {
      const note = createTestNote({ id: 'update-test' });
      await store.create(note);
      
      const result = await store.update('update-test', 'Updated content');
      expect(result).toBe(true);
      
      const retrieved = await store.get('update-test');
      expect(retrieved!.content).toBe('Updated content');
    });

    it('returns false when note does not exist', async () => {
      const result = await store.update('non-existent', 'New content');
      expect(result).toBe(false);
    });

    it('returns false for empty string ID', async () => {
      const result = await store.update('', 'New content');
      expect(result).toBe(false);
    });

    it('preserves other fields when updating content', async () => {
      const note = createTestNote({
        id: 'preserve-test',
        content: 'Original',
        createdAt: 1234567890,
        deleteToken: 'token-123',
      });
      await store.create(note);
      
      await store.update('preserve-test', 'Updated');
      
      const retrieved = await store.get('preserve-test');
      expect(retrieved!.id).toBe('preserve-test');
      expect(retrieved!.createdAt).toBe(1234567890);
      expect(retrieved!.deleteToken).toBe('token-123');
      expect(retrieved!.content).toBe('Updated');
    });

    it('can update to empty string content', async () => {
      const note = createTestNote({ id: 'empty-update' });
      await store.create(note);
      
      await store.update('empty-update', '');
      
      const retrieved = await store.get('empty-update');
      expect(retrieved!.content).toBe('');
    });

    it('can update multiple times', async () => {
      const note = createTestNote({ id: 'multi-update' });
      await store.create(note);
      
      await store.update('multi-update', 'First update');
      await store.update('multi-update', 'Second update');
      await store.update('multi-update', 'Third update');
      
      const retrieved = await store.get('multi-update');
      expect(retrieved!.content).toBe('Third update');
    });
  });

      expect(retrieved3!.content).toBe('Third');
    });

    it('handles empty string content', async () => {
      const note = createTestNote({ content: '' });
      await store.create(note);
      
      const retrieved = await store.get(note.id);
      expect(retrieved!.content).toBe('');
    });

    it('handles unicode content', async () => {
      const note = createTestNote({ content: '你好世界 🌍 مرحبا' });
      await store.create(note);
      
      const retrieved = await store.get(note.id);
      expect(retrieved!.content).toBe('你好世界 🌍 مرحبا');
    });

    it('handles content with special characters', async () => {
      const note = createTestNote({ content: 'Line 1\nLine 2\tTab\r\nCRLF' });
      await store.create(note);
      
      const retrieved = await store.get(note.id);
      expect(retrieved!.content).toBe('Line 1\nLine 2\tTab\r\nCRLF');
    });

  describe('delete()', () => {
    it('deletes an existing note and returns true', async () => {
      const note = createTestNote({ id: 'delete-test' });
      await store.create(note);
      
      const result = await store.delete('delete-test');
      expect(result).toBe(true);
      
      const retrieved = await store.get('delete-test');
      expect(retrieved).toBeNull();
    });

    it('returns false when note does not exist', async () => {
      const result = await store.delete('non-existent');
      expect(result).toBe(false);
    });

    it('returns false for empty string ID', async () => {
      const result = await store.delete('');
      expect(result).toBe(false);
    });

    it('returns false when deleting same note twice', async () => {
      const note = createTestNote({ id: 'double-delete' });
      await store.create(note);
      
      const firstDelete = await store.delete('double-delete');
      expect(firstDelete).toBe(true);
      
      const secondDelete = await store.delete('double-delete');
      expect(secondDelete).toBe(false);
    });

    it('only deletes the specified note', async () => {
      const note1 = createTestNote({ id: 'keep-me' });
      const note2 = createTestNote({ id: 'delete-me' });
      
      await store.create(note1);
      await store.create(note2);
      
      await store.delete('delete-me');
      
      const retrieved1 = await store.get('keep-me');
      const retrieved2 = await store.get('delete-me');
      
      expect(retrieved1).toBeDefined();
      expect(retrieved1!.content).toBe('Test content');
      expect(retrieved2).toBeNull();
    });
  });

  describe('exists()', () => {
    it('returns true for existing note', async () => {
      const note = createTestNote({ id: 'exists-test' });
      await store.create(note);
      
      const result = await store.exists('exists-test');
      expect(result).toBe(true);
    });

    it('returns false for non-existent note', async () => {
      const result = await store.exists('does-not-exist');
      expect(result).toBe(false);
    });

    it('returns false for empty string ID', async () => {
      const result = await store.exists('');
      expect(result).toBe(false);
    });

    it('returns false after note is deleted', async () => {
      const note = createTestNote({ id: 'deleted-note' });
      await store.create(note);
      
      expect(await store.exists('deleted-note')).toBe(true);
      
      await store.delete('deleted-note');
      
      expect(await store.exists('deleted-note')).toBe(false);
    });

    it('returns true for multiple existing notes', async () => {
      const note1 = createTestNote({ id: 'note-1' });
      const note2 = createTestNote({ id: 'note-2' });
      
      await store.create(note1);
      await store.create(note2);
      
      expect(await store.exists('note-1')).toBe(true);
      expect(await store.exists('note-2')).toBe(true);
    });
  });


  describe('cleanupExpired()', () => {
    it('removes expired notes', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      
      const expiredNote = createTestNote({
        id: 'expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      });
      const validNote = createTestNote({
        id: 'valid',
        createdAt: Date.now() - (1 * 60 * 60 * 1000), // 1 hour ago
      });
      
      await store.create(expiredNote);
      await store.create(validNote);
      
      const removedCount = await store.cleanupExpired();
      
      expect(removedCount).toBe(1);
      expect(await store.exists('expired')).toBe(false);
      expect(await store.exists('valid')).toBe(true);
      
      vi.useRealTimers();
    });

    it('removes all expired notes when multiple exist', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      
      const expired1 = createTestNote({
        id: 'expired-1',
        createdAt: Date.now() - (30 * 60 * 60 * 1000), // 30 hours ago
      });
      const expired2 = createTestNote({
        id: 'expired-2',
        createdAt: Date.now() - (26 * 60 * 60 * 1000), // 26 hours ago
      });
      const valid = createTestNote({
        id: 'valid',
        createdAt: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
      });
      
      await store.create(expired1);
      await store.create(expired2);
      await store.create(valid);
      
      const removedCount = await store.cleanupExpired();
      
      expect(removedCount).toBe(2);
      expect(await store.exists('expired-1')).toBe(false);
      expect(await store.exists('expired-2')).toBe(false);
      expect(await store.exists('valid')).toBe(true);
      
      vi.useRealTimers();
    });

    it('returns 0 when no notes are expired', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      
      const note1 = createTestNote({
        id: 'note-1',
        createdAt: Date.now() - (1 * 60 * 60 * 1000),
      });
      const note2 = createTestNote({
        id: 'note-2',
        createdAt: Date.now() - (12 * 60 * 60 * 1000),
      });
      
      await store.create(note1);
      await store.create(note2);
      
      const removedCount = await store.cleanupExpired();
      
      expect(removedCount).toBe(0);
      expect(await store.exists('note-1')).toBe(true);
      expect(await store.exists('note-2')).toBe(true);
      
      vi.useRealTimers();
    });

    it('returns 0 when store is empty', async () => {
      const removedCount = await store.cleanupExpired();
      expect(removedCount).toBe(0);
    });

    it('removes notes exactly at 24 hour boundary', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      
      const exactlyExpired = createTestNote({
        id: 'exactly-24h',
        createdAt: new Date('2024-01-01T12:00:00Z').getTime(), // Exactly 24 hours ago
      });
      
      await store.create(exactlyExpired);
      
      const removedCount = await store.cleanupExpired();
      
      expect(removedCount).toBe(1);
      expect(await store.exists('exactly-24h')).toBe(false);
      
      vi.useRealTimers();
    });

    it('does not remove notes just under 24 hours', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      
      const almostExpired = createTestNote({
        id: 'almost-24h',
        createdAt: new Date('2024-01-01T12:00:01Z').getTime(), // 23h 59m 59s ago
      });
      
      await store.create(almostExpired);
      
      const removedCount = await store.cleanupExpired();
      
      expect(removedCount).toBe(0);
      expect(await store.exists('almost-24h')).toBe(true);
      
      vi.useRealTimers();
    });

    it('can be called multiple times safely', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      
      const expired = createTestNote({
        id: 'expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000),
      });
      
      await store.create(expired);
      
      const firstCleanup = await store.cleanupExpired();
      expect(firstCleanup).toBe(1);
      
      const secondCleanup = await store.cleanupExpired();
      expect(secondCleanup).toBe(0);
      
      vi.useRealTimers();
    });
  });


  describe('edge cases', () => {
    it('handles operations on empty store', async () => {
      expect(await store.get('any-id')).toBeNull();
      expect(await store.update('any-id', 'content')).toBe(false);
      expect(await store.delete('any-id')).toBe(false);
      expect(await store.exists('any-id')).toBe(false);
      expect(await store.cleanupExpired()).toBe(0);
    });

    it('handles concurrent create operations', async () => {
      const notes = Array.from({ length: 10 }, (_, i) =>
        createTestNote({ id: `concurrent-${i}`, content: `Note ${i}` })
      );
      
      await Promise.all(notes.map(note => store.create(note)));
      
      for (let i = 0; i < 10; i++) {
        const retrieved = await store.get(`concurrent-${i}`);
        expect(retrieved).toBeDefined();
        expect(retrieved!.content).toBe(`Note ${i}`);
      }
    });

    it('handles concurrent read operations', async () => {
      const note = createTestNote({ id: 'concurrent-read' });
      await store.create(note);
      
      const results = await Promise.all(
        Array.from({ length: 10 }, () => store.get('concurrent-read'))
      );
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result!.id).toBe('concurrent-read');
      });
    });

    it('handles concurrent update operations', async () => {
      const note = createTestNote({ id: 'concurrent-update' });
      await store.create(note);
      
      const updates = Array.from({ length: 10 }, (_, i) =>
        store.update('concurrent-update', `Update ${i}`)
      );
      
      const results = await Promise.all(updates);
      results.forEach(result => {
        expect(result).toBe(true);
      });
      
      const retrieved = await store.get('concurrent-update');
      expect(retrieved!.content).toMatch(/^Update \d+$/);
    });

    it('handles concurrent delete operations', async () => {
      const note = createTestNote({ id: 'concurrent-delete' });
      await store.create(note);
      
      const deletes = Array.from({ length: 10 }, () =>
        store.delete('concurrent-delete')
      );
      
      const results = await Promise.all(deletes);
      const successCount = results.filter(r => r === true).length;
      expect(successCount).toBe(1);
      expect(await store.exists('concurrent-delete')).toBe(false);
    });

    it('handles very long IDs', async () => {
      const longId = 'a'.repeat(1000);
      const note = createTestNote({ id: longId });
      
      await store.create(note);
      const retrieved = await store.get(longId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(longId);
    });

    it('handles very long content', async () => {
      const longContent = 'x'.repeat(100 * 1024); // 100KB
      const note = createTestNote({ content: longContent });
      
      await store.create(note);
      const retrieved = await store.get(note.id);
      
      expect(retrieved!.content).toBe(longContent);
      expect(retrieved!.content.length).toBe(100 * 1024);
    });

    it('maintains data integrity across multiple operations', async () => {
      const note1 = createTestNote({ id: 'integrity-1', content: 'First' });
      const note2 = createTestNote({ id: 'integrity-2', content: 'Second' });
      
      await store.create(note1);
      await store.create(note2);
      await store.update('integrity-1', 'Updated First');
      await store.delete('integrity-2');
      
      const note3 = createTestNote({ id: 'integrity-3', content: 'Third' });
      await store.create(note3);
      
      expect((await store.get('integrity-1'))!.content).toBe('Updated First');
      expect(await store.get('integrity-2')).toBeNull();
      expect((await store.get('integrity-3'))!.content).toBe('Third');
    });
  });


  describe('data integrity', () => {
    it('stored data matches input exactly', async () => {
      const original = createTestNote({
        id: 'exact-match',
        content: 'Exact content with special chars: !@#$%^&*()',
        createdAt: 9876543210,
        deleteToken: 'exact-token-123',
      });
      
      await store.create(original);
      const retrieved = await store.get('exact-match');
      
      expect(retrieved).toEqual(original);
    });

    it('does not allow mutation through retrieved object', async () => {
      const note = createTestNote({ id: 'immutable' });
      await store.create(note);
      
      const retrieved = await store.get('immutable');
      retrieved!.content = 'Mutated!';
      
      const retrievedAgain = await store.get('immutable');
      expect(retrievedAgain!.content).toBe('Test content');
    });

    it('preserves all NoteRecord fields', async () => {
      const note: NoteRecord = {
        id: 'fields-test',
        content: 'Content',
        createdAt: 1111111111,
        deleteToken: 'token-abc-123',
      };
      
      await store.create(note);
      const retrieved = await store.get('fields-test');
      
      expect(retrieved).toHaveProperty('id');
      expect(retrieved).toHaveProperty('content');
      expect(retrieved).toHaveProperty('createdAt');
      expect(retrieved).toHaveProperty('deleteToken');
      
      expect(retrieved!.id).toBe('fields-test');
      expect(retrieved!.content).toBe('Content');
      expect(retrieved!.createdAt).toBe(1111111111);
      expect(retrieved!.deleteToken).toBe('token-abc-123');
    });
  });


  describe('interface compliance', () => {
    it('implements NoteStore interface', () => {
      expect(typeof store.create).toBe('function');
      expect(typeof store.get).toBe('function');
      expect(typeof store.update).toBe('function');
      expect(typeof store.delete).toBe('function');
    });

    it('create returns Promise<void>', async () => {
      const note = createTestNote();
      const result = store.create(note);
      
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('get returns Promise<NoteRecord | null>', async () => {
      const result = store.get('any-id');
      expect(result).toBeInstanceOf(Promise);
      
      const value = await result;
      expect(value === null || typeof value === 'object').toBe(true);
    });

    it('update returns Promise<boolean>', async () => {
      const result = store.update('any-id', 'content');
      expect(result).toBeInstanceOf(Promise);
      
      const value = await result;
      expect(typeof value).toBe('boolean');
    });

    it('delete returns Promise<boolean>', async () => {
      const result = store.delete('any-id');
      expect(result).toBeInstanceOf(Promise);
      
      const value = await result;
      expect(typeof value).toBe('boolean');
    });

    it('exists returns Promise<boolean>', async () => {
      const result = store.exists('any-id');
      expect(result).toBeInstanceOf(Promise);
      
      const value = await result;
      expect(typeof value).toBe('boolean');
    });

    it('cleanupExpired returns Promise<number>', async () => {
      const result = store.cleanupExpired();
      expect(result).toBeInstanceOf(Promise);
      
      const value = await result;
      expect(typeof value).toBe('number');
    });
  });
});

  });
