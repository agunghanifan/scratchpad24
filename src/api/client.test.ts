/**
 * Tests for API client — fetch-based client with error handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNote, getNote, updateNote, deleteNote } from './client';

describe('API client', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('createNote', () => {
    it('returns noteId and deleteToken on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ noteId: 'abc', deleteToken: 'tok' }),
      });
      const result = await createNote('Hello');
      expect(result).toEqual({ noteId: 'abc', deleteToken: 'tok' });
      expect(mockFetch).toHaveBeenCalledWith('/api/notes', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });
      await expect(createNote('Hello')).rejects.toThrow('Failed to create note');
    });
  });

  describe('getNote', () => {
    it('returns note data on success', async () => {
      const noteData = { id: 'abc', content: 'Hello', createdAt: 1, expiresAt: 2 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => noteData,
      });
      const result = await getNote('abc');
      expect(result).toEqual(noteData);
    });

    it('throws "Not found" on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      try {
        await getNote('abc');
        expect.fail('should have thrown');
      } catch (err) {
        const error = err as Error & { status?: number };
        expect(error.message).toBe('Not found');
        expect(error.status).toBe(404);
      }
    });

    it('throws "Failed to fetch note" on other errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      try {
        await getNote('abc');
        expect.fail('should have thrown');
      } catch (err) {
        const error = err as Error & { status?: number };
        expect(error.message).toBe('Failed to fetch note');
        expect(error.status).toBe(500);
      }
    });
  });

  describe('updateNote', () => {
    it('returns success on ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      const result = await updateNote('abc', 'new content', 'test-token');
      expect(result).toEqual({ success: true });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not found',
      });
      await expect(updateNote('abc', 'content', 'test-token')).rejects.toThrow('Failed to update note');
    });
  });

  describe('deleteNote', () => {
    it('returns success on ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      const result = await deleteNote('abc', 'token');
      expect(result).toEqual({ success: true });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
      });
      await expect(deleteNote('abc', 'token')).rejects.toThrow('Failed to delete note');
    });
  });
});
