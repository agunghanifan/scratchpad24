/**
 * Tests for getNote API handler — Milestone 4
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
    method: 'GET',
    params: { noteId: 'valid-uuid-id' },
    body: undefined,
    headers: {},
    ...overrides,
  };
}

describe('getNote handler', () => {
  let handler: (req: GenericRequest) => Promise<GenericResponse>;
  let store: NoteStore;

  beforeEach(async () => {
    store = createMockStore();
    const { createGetNoteHandler } = await import('./getNote');
    handler = createGetNoteHandler(store);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe('happy path', () => {
    it('returns 200 with note data', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Hello', createdAt: Date.now(), deleteToken: 't',
      });
      const res = await handler(makeRequest());
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('expiresAt');
    });

    it('does NOT expose deleteToken', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Secret', createdAt: Date.now(), deleteToken: 'secret',
      });
      const res = await handler(makeRequest());
      const body = res.body as { deleteToken?: string };
      expect(body.deleteToken).toBeUndefined();
    });

    it('calculates expiresAt as createdAt + 24h', async () => {
      const createdAt = Date.now();
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Hi', createdAt, deleteToken: 't',
      });
      const res = await handler(makeRequest());
      const body = res.body as { expiresAt?: number };
      expect(body.expiresAt).toBe(createdAt + 24 * 60 * 60 * 1000);
    });
  });

  describe('CRITICAL: uniform 404 responses', () => {
    it('returns 404 when note never existed', async () => {
      vi.mocked(store.get).mockResolvedValueOnce(null);
      const res = await handler(makeRequest({ params: { noteId: 'never-existed' } }));
      expect(res.status).toBe(404);
    });

    it('returns 404 when note is expired', async () => {
      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 't',
      });
      const res = await handler(makeRequest());
      expect(res.status).toBe(404);
    });

    it('returns SAME error shape for not found vs expired', async () => {
      vi.mocked(store.get).mockResolvedValueOnce(null);
      const res1 = await handler(makeRequest({ params: { noteId: 'never-existed' } }));

      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 't',
      });
      const res2 = await handler(makeRequest());

      expect(res1.status).toBe(res2.status);
      expect(res1.body).toEqual(res2.body);
    });

    it('error message does not distinguish not found from expired', async () => {
      vi.mocked(store.get).mockResolvedValueOnce(null);
      const res1 = await handler(makeRequest({ params: { noteId: 'never-existed' } }));

      vi.mocked(store.get).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 't',
      });
      const res2 = await handler(makeRequest());

      const body1 = res1.body as { error?: string };
      const body2 = res2.body as { error?: string };
      const msg1 = (body1.error ?? '').toLowerCase();
      const msg2 = (body2.error ?? '').toLowerCase();
      expect(msg1).toBe(msg2);
      expect(msg1).not.toContain('expired');
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

    it('returns 400 for path traversal', async () => {
      const res = await handler(makeRequest({ params: { noteId: '../../../etc/passwd' } }));
      expect(res.status).toBe(400);
    });

    it('returns 400 for HTML injection', async () => {
      const res = await handler(makeRequest({ params: { noteId: '<script>' } }));
      expect(res.status).toBe(400);
    });

    it('does not call store.get for malformed IDs', async () => {
      await handler(makeRequest({ params: { noteId: '<script>' } }));
      expect(store.get).not.toHaveBeenCalled();
    });
  });

  describe('method validation', () => {
    it('returns 405 for non-GET methods', async () => {
      expect((await handler(makeRequest({ method: 'POST' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'PUT' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'DELETE' }))).status).toBe(405);
    });
  });

  describe('error handling', () => {
    it('returns 500 when store.get throws', async () => {
      vi.mocked(store.get).mockRejectedValueOnce(new Error('DB error'));
      const res = await handler(makeRequest());
      expect(res.status).toBe(500);
    });
  });
});
