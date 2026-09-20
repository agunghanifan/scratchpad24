/**
 * Tests for updateNote API handler — Milestone 4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NoteStore } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse } from './types';

const MAX_PAYLOAD_BYTES = 100 * 1024;

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
    method: 'PUT',
    params: { noteId: 'valid-uuid-id' },
    body: { content: 'Updated content' },
    headers: { 'content-type': 'application/json' },
    ...overrides,
  };
}

describe('updateNote handler', () => {
  let handler: (req: GenericRequest) => Promise<GenericResponse>;
  let store: NoteStore;

  beforeEach(async () => {
    store = createMockStore();
    const { createUpdateNoteHandler } = await import('./updateNote');
    handler = createUpdateNoteHandler(store);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe('happy path', () => {
    it('returns 200 with { success: true }', async () => {
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Old', createdAt: Date.now(), deleteToken: 't',
      });
      (store.update as any).mockResolvedValueOnce(true);
      const res = await handler(makeRequest());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('calls store.update with sanitized content', async () => {
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Old', createdAt: Date.now(), deleteToken: 't',
      });
      (store.update as any).mockResolvedValueOnce(true);
      await handler(makeRequest({ body: { content: '<b>bold</b>' } }));
      expect(store.update).toHaveBeenCalledWith('valid-uuid-id', expect.not.stringContaining('<'));
    });

    it('accepts PATCH method', async () => {
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Old', createdAt: Date.now(), deleteToken: 't',
      });
      (store.update as any).mockResolvedValueOnce(true);
      const res = await handler(makeRequest({ method: 'PATCH' }));
      expect(res.status).toBe(200);
    });
  });

  describe('uniform 404 for not found / expired', () => {
    it('returns 404 when note does not exist', async () => {
      (store.get as any).mockResolvedValueOnce(null);
      const res = await handler(makeRequest());
      expect(res.status).toBe(404);
    });

    it('returns 404 when note is expired', async () => {
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 't',
      });
      const res = await handler(makeRequest());
      expect(res.status).toBe(404);
    });

    it('returns SAME error shape for not found vs expired', async () => {
      (store.get as any).mockResolvedValueOnce(null);
      const res1 = await handler(makeRequest());
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Expired',
        createdAt: Date.now() - (25 * 60 * 60 * 1000), deleteToken: 't',
      });
      const res2 = await handler(makeRequest());
      expect(res1.status).toBe(res2.status);
      expect(res1.body).toEqual(res2.body);
    });
  });

  describe('validation', () => {
    it('returns 400 when body is missing', async () => {
      const res = await handler(makeRequest({ body: undefined }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when content is missing', async () => {
      const res = await handler(makeRequest({ body: {} }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when content is empty', async () => {
      const res = await handler(makeRequest({ body: { content: '' } }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when content is not a string', async () => {
      const res = await handler(makeRequest({ body: { content: 123 } }));
      expect(res.status).toBe(400);
    });
  });

  describe('payload cap', () => {
    it('returns 413 when content exceeds 100KB', async () => {
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Old', createdAt: Date.now(), deleteToken: 't',
      });
      const res = await handler(makeRequest({ body: { content: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) } }));
      expect(res.status).toBe(413);
    });

    it('accepts content exactly at 100KB', async () => {
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Old', createdAt: Date.now(), deleteToken: 't',
      });
      (store.update as any).mockResolvedValueOnce(true);
      const res = await handler(makeRequest({ body: { content: 'x'.repeat(MAX_PAYLOAD_BYTES) } }));
      expect(res.status).toBe(200);
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
    it('returns 405 for non-PUT/PATCH methods', async () => {
      expect((await handler(makeRequest({ method: 'GET' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'POST' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'DELETE' }))).status).toBe(405);
    });
  });

  describe('error handling', () => {
    it('returns 500 when store.update throws', async () => {
      (store.get as any).mockResolvedValueOnce({
        id: 'valid-uuid-id', content: 'Old', createdAt: Date.now(), deleteToken: 't',
      });
      (store.update as any).mockRejectedValueOnce(new Error('DB error'));
      const res = await handler(makeRequest());
      expect(res.status).toBe(500);
    });

    it('returns 500 when store.get throws', async () => {
      (store.get as any).mockRejectedValueOnce(new Error('DB error'));
      const res = await handler(makeRequest());
      expect(res.status).toBe(500);
      expect((res.body as any).error).toBe('Internal server error');
    });
  });
});
