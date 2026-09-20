/**
 * Tests for deleteNote API handler — Milestone 4
 * CRITICAL: Uniform 404 for all failure modes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NoteStore } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse } from './types';

function createMockStore(): NoteStore {
  return {
    create: vi.fn(async () => {}),
    get: vi.fn(async () => null),
    update: vi.fn(async () => false),
    delete: vi.fn(async () => false),
    exists: vi.fn(async () => false),
  };
}

function makeRequest(overrides: Partial<GenericRequest> = {}): GenericRequest {
  return {
    method: 'DELETE',
    params: { noteId: 'valid-uuid-id' },
    body: { deleteToken: 'correct-token' },
    headers: {},
    ...overrides,
  };
}

describe('deleteNote handler', () => {
  let handler: (req: GenericRequest) => Promise<GenericResponse>;
  let store: NoteStore;

  beforeEach(async () => {
    store = createMockStore();
    const { createDeleteNoteHandler } = await import('./deleteNote');
    handler = createDeleteNoteHandler(store);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe('happy path', () => {
    it('returns 200 with { success: true }', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'correct-token',
      });
      vi.mocked(store.delete).mockResolvedValueOnce(true);
      const res = await handler(makeRequest());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('calls store.delete with correct noteId', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'correct-token',
      });
      vi.mocked(store.delete).mockResolvedValueOnce(true);
      await handler(makeRequest());
      expect(store.delete).toHaveBeenCalledWith('valid-uuid-id');
    });

    it('accepts deleteToken from header', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'header-token',
      });
      vi.mocked(store.delete).mockResolvedValueOnce(true);
      const res = await handler(makeRequest({
        body: undefined,
        headers: { 'x-delete-token': 'header-token' },
      }));
      expect(res.status).toBe(200);
    });
  });

  describe('CRITICAL: uniform 404 for all failure modes', () => {
    it('returns 404 when note never existed', async () => {
      vi.mocked(store.get).mockResolvedValueOnce(null);
      const res = await handler(makeRequest());
      expect(res.status).toBe(404);
    });

    it('returns 404 when note is expired', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 'correct-token',
      });
      const res = await handler(makeRequest());
      expect(res.status).toBe(404);
    });

    it('returns 404 when token is wrong', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'correct-token',
      });
      const res = await handler(makeRequest({ body: { deleteToken: 'wrong' } }));
      expect(res.status).toBe(404);
    });

    it('returns SAME error shape for all three failure modes', async () => {
      vi.mocked(store.get).mockResolvedValueOnce(null);
      const res1 = await handler(makeRequest());

      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 'correct-token',
      });
      const res2 = await handler(makeRequest());

      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'correct-token',
      });
      const res3 = await handler(makeRequest({ body: { deleteToken: 'wrong' } }));

      expect(res1.status).toBe(res2.status);
      expect(res2.status).toBe(res3.status);
      expect(res1.body).toEqual(res2.body);
      expect(res2.body).toEqual(res3.body);
    });

    it('error message does not distinguish failure modes', async () => {
      vi.mocked(store.get).mockResolvedValueOnce(null);
      const res1 = await handler(makeRequest());

      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 'correct-token',
      });
      const res2 = await handler(makeRequest());

      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'correct-token',
      });
      const res3 = await handler(makeRequest({ body: { deleteToken: 'wrong' } }));

      const body1 = res1.body as { error?: string };
      const body2 = res2.body as { error?: string };
      const body3 = res3.body as { error?: string };
      const msg1 = (body1.error ?? '').toLowerCase();
      const msg2 = (body2.error ?? '').toLowerCase();
      const msg3 = (body3.error ?? '').toLowerCase();
      expect(msg1).toBe(msg2);
      expect(msg2).toBe(msg3);
      expect(msg1).not.toContain('expired');
      expect(msg1).not.toContain('token');
    });

    it('does not call store.delete when token is wrong', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'correct-token',
      });
      await handler(makeRequest({ body: { deleteToken: 'wrong' } }));
      expect(store.delete).not.toHaveBeenCalled();
    });
  });

  describe('validation: missing token', () => {
    it('returns 400 when token is missing', async () => {
      const res = await handler(makeRequest({ body: {}, headers: {} }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is missing', async () => {
      const res = await handler(makeRequest({ body: undefined, headers: {} }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when token is empty', async () => {
      const res = await handler(makeRequest({ body: { deleteToken: '' }, headers: {} }));
      expect(res.status).toBe(400);
    });
  });

  describe('malformed ID validation', () => {
    it('returns 400 for empty noteId', async () => {
      const res = await handler(makeRequest({ params: { noteId: '' } }));
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing noteId', async () => {
      const res = await handler(makeRequest({ params: {} }));
      expect(res.status).toBe(400);
    });

    it('does not call store for malformed IDs', async () => {
      await handler(makeRequest({ params: { noteId: '<script>' } }));
      expect(store.get).not.toHaveBeenCalled();
    });
  });

  describe('method validation', () => {
    it('returns 405 for non-DELETE methods', async () => {
      expect((await handler(makeRequest({ method: 'GET' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'POST' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'PUT' }))).status).toBe(405);
    });
  });

  describe('error handling', () => {
    it('returns 500 when store.delete throws', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'C',
        createdAt: Date.now(), deleteToken: 'correct-token',
      });
      vi.mocked(store.delete).mockRejectedValueOnce(new Error('DB error'));
      const res = await handler(makeRequest());
      expect(res.status).toBe(500);
    });

    it('returns 500 when store.get throws', async () => {
      vi.mocked(store.get).mockRejectedValueOnce(new Error('DB error'));
      const res = await handler(makeRequest());
      expect(res.status).toBe(500);
      const body = res.body as { error?: string };
      expect(body.error).toBe('Internal server error');
    });
  });
});
