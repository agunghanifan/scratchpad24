/**
 * Tests for createNote API handler — Milestone 4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NoteStore, NoteRecord } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse } from './types';

const MAX_PAYLOAD_BYTES = 100 * 1024;

function createMockStore(): NoteStore {
  return {
    create: vi.fn(async (_note: NoteRecord) => {}),
    get: vi.fn(async () => null),
    update: vi.fn(async () => false),
    delete: vi.fn(async () => false),
    exists: vi.fn(async () => false),
  };
}

function makeRequest(overrides: Partial<GenericRequest> = {}): GenericRequest {
  return {
    method: 'POST',
    params: {},
    body: { content: 'Hello world' },
    headers: { 'content-type': 'application/json' },
    ...overrides,
  };
}

describe('createNote handler', () => {
  let handler: (req: GenericRequest) => Promise<GenericResponse>;
  let store: NoteStore;

  beforeEach(async () => {
    store = createMockStore();
    const { createCreateNoteHandler } = await import('./createNote');
    handler = createCreateNoteHandler(store);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe('happy path', () => {
    it('returns 201 with noteId and deleteToken', async () => {
      const res = await handler(makeRequest({ body: { content: 'Test' } }));
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('noteId');
      expect(res.body).toHaveProperty('deleteToken');
    });

    it('calls store.create with sanitized content', async () => {
      await handler(makeRequest({ body: { content: '<script>alert(1)</script>' } }));
      expect(store.create).toHaveBeenCalledTimes(1);
      const stored = vi.mocked(store.create).mock.calls[0][0] as NoteRecord;
      expect(stored.content).not.toContain('<');
    });

    it('accepts empty string content (user can create blank pad and edit later)', async () => {
      const res = await handler(makeRequest({ body: { content: '' } }));
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('noteId');
      expect(res.body).toHaveProperty('deleteToken');
      expect(store.create).toHaveBeenCalledTimes(1);
      const stored = vi.mocked(store.create).mock.calls[0][0] as NoteRecord;
      expect(stored.content).toBe('');
    });

    it('accepts whitespace-only content', async () => {
      const res = await handler(makeRequest({ body: { content: '   \n\t  ' } }));
      expect(res.status).toBe(201);
      expect(store.create).toHaveBeenCalledTimes(1);
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

    it('returns 400 when content is not a string', async () => {
      const res = await handler(makeRequest({ body: { content: 123 } }));
      expect(res.status).toBe(400);
    });
  describe('payload cap', () => {
    it('returns 413 when content exceeds 100KB', async () => {
      const res = await handler(makeRequest({ body: { content: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) } }));
      expect(res.status).toBe(413);
    });

    it('returns 413 for multibyte content exceeding 100KB', async () => {
      // Each 😀 is 4 bytes in UTF-8; 25,601 * 4 = 102,404 > 102,400 (100KB)
      const res = await handler(makeRequest({ body: { content: '😀'.repeat(25601) } }));
      expect(res.status).toBe(413);
    });

    it('accepts content exactly at 100KB', async () => {
      const res = await handler(makeRequest({ body: { content: 'x'.repeat(MAX_PAYLOAD_BYTES) } }));
      expect(res.status).toBe(201);
    });

    it('does not silently truncate oversized content', async () => {
      const res = await handler(makeRequest({ body: { content: 'x'.repeat(MAX_PAYLOAD_BYTES + 1000) } }));
      expect(res.status).toBe(413);
      expect(store.create).not.toHaveBeenCalled();
    });
  });

  describe('security', () => {
    it('strips HTML tags from content', async () => {
      await handler(makeRequest({ body: { content: '<b>bold</b>' } }));
      const stored = vi.mocked(store.create).mock.calls[0][0] as NoteRecord;
      expect(stored.content).not.toContain('<');
      expect(stored.content).not.toContain('>');
    });
  });

  describe('error handling', () => {
    it('returns 500 when store.create throws', async () => {
      vi.mocked(store.create).mockRejectedValueOnce(new Error('Storage failure'));
      const res = await handler(makeRequest({ body: { content: 'Test' } }));
      expect(res.status).toBe(500);
    });

    it('does not leak internal error details', async () => {
      vi.mocked(store.create).mockRejectedValueOnce(new Error('Internal DB error'));
      const res = await handler(makeRequest({ body: { content: 'Test' } }));
      const body = res.body as { error?: string };
      const msg = (body.error ?? '').toLowerCase();
      expect(msg).not.toContain('internal db');
    });
  });

  describe('method validation', () => {
    it('returns 405 for non-POST methods', async () => {
      expect((await handler(makeRequest({ method: 'GET' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'PUT' }))).status).toBe(405);
      expect((await handler(makeRequest({ method: 'DELETE' }))).status).toBe(405);
    });
  });
  });
});

