/**
 * Tests for useNote hook — Milestone 5
 * Fetches note by ID, handles loading/error states.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useNote from './useNote';

// Mock the API client
const mockGetNote = vi.fn();
vi.mock('../api/client', () => ({
  getNote: (...args: unknown[]) => mockGetNote(...args),
}));

describe('useNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetching note by ID', () => {
    it('fetches note from API with correct ID', async () => {
      const noteData = {
        id: 'test-note-id',
        content: 'Hello world',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      mockGetNote.mockResolvedValue(noteData);

      const { result } = renderHook(() => useNote('test-note-id'));

      await waitFor(() => {
        expect(result.current.note).toEqual(noteData);
      });

      expect(mockGetNote).toHaveBeenCalledWith('test-note-id');
    });

    it('returns note data with id, content, createdAt, expiresAt', async () => {
      const now = Date.now();
      const noteData = {
        id: 'abc-123',
        content: 'Test content',
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      };
      mockGetNote.mockResolvedValue(noteData);

      const { result } = renderHook(() => useNote('abc-123'));

      await waitFor(() => {
        expect(result.current.note).toBeDefined();
        expect(result.current.note?.id).toBe('abc-123');
        expect(result.current.note?.content).toBe('Test content');
        expect(result.current.note?.createdAt).toBe(now);
        expect(result.current.note?.expiresAt).toBe(now + 24 * 60 * 60 * 1000);
      });
    });
  });

  describe('loading state', () => {
    it('starts with loading=true', () => {
      mockGetNote.mockImplementation(() => new Promise(() => {})); // Never resolves
      const { result } = renderHook(() => useNote('test-id'));
      expect(result.current.loading).toBe(true);
    });

    it('sets loading=false after fetch completes', async () => {
      mockGetNote.mockResolvedValue({
        id: 'test-id',
        content: 'test',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      const { result } = renderHook(() => useNote('test-id'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('error state', () => {
    it('handles 404 for expired note', async () => {
      const error = new Error('Not found');
      (error as any).status = 404;
      mockGetNote.mockRejectedValue(error);

      const { result } = renderHook(() => useNote('expired-id'));

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toMatch(/not found|expired/i);
      });
    });

    it('handles 404 for non-existent note', async () => {
      const error = new Error('Not found');
      (error as any).status = 404;
      mockGetNote.mockRejectedValue(error);

      const { result } = renderHook(() => useNote('nonexistent-id'));

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });

    it('handles network errors', async () => {
      mockGetNote.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNote('test-id'));

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toBe('Network error');
      });
    });

    it('sets loading=false on error', async () => {
      mockGetNote.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useNote('test-id'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeDefined();
      });
    });

    it('returns null note on error', async () => {
      mockGetNote.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useNote('test-id'));

      await waitFor(() => {
        expect(result.current.note).toBeNull();
      });
    });

    it('handles non-Error rejection (string thrown)', async () => {
      mockGetNote.mockRejectedValue('string error');

      const { result } = renderHook(() => useNote('test-id'));

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Failed to fetch note');
        expect(result.current.loading).toBe(false);
        expect(result.current.note).toBeNull();
      });
    });
  });

  describe('uniform error handling', () => {
    it('same error shape for expired and non-existent notes', async () => {
      const error = new Error('Not found');
      (error as any).status = 404;
      mockGetNote.mockRejectedValue(error);

      const { result: result1 } = renderHook(() => useNote('expired-id'));
      await waitFor(() => expect(result1.current.error).toBeDefined());

      mockGetNote.mockRejectedValue(error);
      const { result: result2 } = renderHook(() => useNote('nonexistent-id'));
      await waitFor(() => expect(result2.current.error).toBeDefined());

      // Both should have same error structure
      expect(result1.current.error?.message).toBe(result2.current.error?.message);
    });
  });
});
