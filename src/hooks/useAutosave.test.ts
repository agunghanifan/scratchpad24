/**
 * Tests for useAutosave hook — Milestone 5
 * Debounced auto-save with status tracking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAutosave from './useAutosave';

const mockUpdateNote = vi.fn();
vi.mock('../api/client', () => ({
  updateNote: (...args: unknown[]) => mockUpdateNote(...args),
}));

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUpdateNote.mockResolvedValue({ success: true });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe('debounced saves', () => {
    it('debounces saves (~800ms)', () => {
      renderHook(({ c }) => useAutosave('note-id', c, 'test-token-123'), { initialProps: { c: 'initial' } });
      expect(mockUpdateNote).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(500); });
      expect(mockUpdateNote).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(400); });
      expect(mockUpdateNote).toHaveBeenCalledWith('note-id', 'initial', 'test-token-123');
    });

    it('resets debounce timer on content change', () => {
      const { rerender } = renderHook(
        ({ c }) => useAutosave('note-id', c, 'test-token-123'),
        { initialProps: { c: 'a' } }
      );
      act(() => { vi.advanceTimersByTime(400); });
      rerender({ c: 'ab' });
      act(() => { vi.advanceTimersByTime(400); });
      rerender({ c: 'abc' });
      expect(mockUpdateNote).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).toHaveBeenCalledWith('note-id', 'abc', 'test-token-123');
    });

    it('only saves once for rapid changes', () => {
      const { rerender } = renderHook(
        ({ c }) => useAutosave('note-id', c, 'test-token-123'),
        { initialProps: { c: 'a' } }
      );
      for (const ch of ['b', 'c', 'd', 'e']) {
        rerender({ c: ch });
        act(() => { vi.advanceTimersByTime(100); });
      }
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).toHaveBeenCalledTimes(1);
      expect(mockUpdateNote).toHaveBeenCalledWith('note-id', 'e', 'test-token-123');
    });
  });

  describe('API calls', () => {
    it('calls API to update note content', () => {
      renderHook(() => useAutosave('note-id', 'test content', 'test-token-123'));
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).toHaveBeenCalledWith('note-id', 'test content', 'test-token-123');
    });

    it('does not save when content is unchanged', () => {
      const { rerender } = renderHook(
        ({ c }) => useAutosave('note-id', c, 'test-token-123'),
        { initialProps: { c: 'same' } }
      );
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).toHaveBeenCalledTimes(1);
      rerender({ c: 'same' });
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).toHaveBeenCalledTimes(1);
    });
  });

  describe('save status', () => {
    it('returns status "saving" while save is in progress', () => {
      mockUpdateNote.mockImplementation(() => new Promise(() => {}));
      const { result } = renderHook(() => useAutosave('note-id', 'content', 'test-token-123'));
      act(() => { vi.advanceTimersByTime(800); });
      expect(result.current.status).toBe('saving');
    });

    it('returns status "saved" after successful save', async () => {
      mockUpdateNote.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAutosave('note-id', 'content', 'test-token-123'));
      await act(async () => { vi.advanceTimersByTime(800); await Promise.resolve(); });
      expect(result.current.status).toBe('saved');
    });

    it('returns status "error" when save fails', async () => {
      mockUpdateNote.mockRejectedValue(new Error('Save failed'));
      const { result } = renderHook(() => useAutosave('note-id', 'content', 'test-token-123'));
      await act(async () => { vi.advanceTimersByTime(800); await Promise.resolve(); });
      expect(result.current.status).toBe('error');
    });

    it('handles save errors gracefully — does not crash', async () => {
      mockUpdateNote.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useAutosave('note-id', 'content', 'test-token-123'));
      await act(async () => { vi.advanceTimersByTime(800); await Promise.resolve(); });
      expect(result.current.error).toBeDefined();
    });

    it('handles non-Error rejection (string thrown)', async () => {
      mockUpdateNote.mockRejectedValue('string error');
      const { result } = renderHook(() => useAutosave('note-id', 'content', 'test-token-123'));
      await act(async () => { vi.advanceTimersByTime(800); await Promise.resolve(); });
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Save failed');
    });

    it('can retry after error', async () => {
      mockUpdateNote.mockRejectedValueOnce(new Error('Failed'));
      mockUpdateNote.mockResolvedValueOnce({ success: true });
      const { result, rerender } = renderHook(
        ({ c }) => useAutosave('note-id', c, 'test-token-123'),
        { initialProps: { c: 'content' } }
      );
      await act(async () => { vi.advanceTimersByTime(800); await Promise.resolve(); });
      expect(result.current.status).toBe('error');
      rerender({ c: 'new content' });
      await act(async () => { vi.advanceTimersByTime(800); await Promise.resolve(); });
      expect(result.current.status).toBe('saved');
    });
  });

  describe('edge cases', () => {
    it('does not save empty content', () => {
      renderHook(() => useAutosave('note-id', '', 'test-token-123'));
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).not.toHaveBeenCalled();
    });

    it('does not save when content exceeds 100KB', () => {
      const oversized = 'a'.repeat(100 * 1024 + 1);
      renderHook(() => useAutosave('note-id', oversized, 'test-token-123'));
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).not.toHaveBeenCalled();
    });

    it('does not call API when deleteToken is null', () => {
      renderHook(() => useAutosave('note-id', 'some content', null));
      act(() => { vi.advanceTimersByTime(800); });
      expect(mockUpdateNote).not.toHaveBeenCalled();
    });
  });
});
