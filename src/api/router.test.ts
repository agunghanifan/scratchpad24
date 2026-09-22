/**
 * Unit tests for the shared API router — route matching, dispatch,
 * rate limiting, and security headers.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiRouter, type ApiRequest } from './router';
import { InMemoryNoteStore } from '../storage/InMemoryNoteStore';
import { createRateLimiter } from './rateLimiter';
import type { NoteStore } from '../storage/NoteStore';
import type { GenericResponse } from './types';

function makeRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    url: '/api/notes',
    method: 'POST',
    headers: {},
    body: { content: 'Hello' },
    ...overrides,
  };
}

describe('createApiRouter', () => {
  let store: NoteStore;

  beforeEach(() => {
    store = new InMemoryNoteStore();
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_CREATE;
  });

  describe('route matching', () => {
    it('returns null for non-API URLs', async () => {
      const router = createApiRouter(store);
      const res = await router.handle(makeRequest({ url: '/', method: 'GET' }));
      expect(res).toBeNull();
    });

    it('creates a note on POST /api/notes', async () => {
      const router = createApiRouter(store);
      const res = await router.handle(makeRequest());
      expect(res).not.toBeNull();
      expect(res!.status).toBe(201);
      const body = res!.body as { noteId: string; deleteToken: string };
      expect(body.noteId).toBeDefined();
      expect(body.deleteToken).toBeDefined();
    });

    it('gets a note on GET /api/notes/:id', async () => {
      const router = createApiRouter(store);
      const created = (await router.handle(makeRequest()))!.body as { noteId: string };
      const res = await router.handle(makeRequest({
        url: `/api/notes/${created.noteId}`, method: 'GET',
      }));
      expect(res!.status).toBe(200);
      expect((res!.body as { content: string }).content).toBe('Hello');
    });

    it('updates a note on PUT /api/notes/:id with delete token', async () => {
      const router = createApiRouter(store);
      const created = (await router.handle(makeRequest()))!.body as { noteId: string; deleteToken: string };
      const res = await router.handle(makeRequest({
        url: `/api/notes/${created.noteId}`, method: 'PUT',
        body: { content: 'Updated', deleteToken: created.deleteToken },
      }));
      expect(res!.status).toBe(200);
    });

    it('updates a note on PATCH /api/notes/:id with delete token', async () => {
      const router = createApiRouter(store);
      const created = (await router.handle(makeRequest()))!.body as { noteId: string; deleteToken: string };
      const res = await router.handle(makeRequest({
        url: `/api/notes/${created.noteId}`, method: 'PATCH',
        body: { content: 'Patched', deleteToken: created.deleteToken },
      }));
      expect(res!.status).toBe(200);
    });

    it('returns 405 for unsupported methods on an existing note path', async () => {
      const router = createApiRouter(store);
      const created = (await router.handle(makeRequest()))!.body as { noteId: string };
      const res = await router.handle(makeRequest({
        url: `/api/notes/${created.noteId}`, method: 'POST',
        body: { deleteToken: 'x' },
      }));
      expect(res!.status).toBe(405);
    });

    it('deletes a note on DELETE /api/notes/:id with delete token', async () => {
      const router = createApiRouter(store);
      const created = (await router.handle(makeRequest()))!.body as { noteId: string; deleteToken: string };
      const res = await router.handle(makeRequest({
        url: `/api/notes/${created.noteId}`, method: 'DELETE',
        body: { deleteToken: created.deleteToken },
      }));
      expect(res!.status).toBe(200);
    });

    it('returns 404 for unknown API paths', async () => {
      const router = createApiRouter(store);
      const res = await router.handle(makeRequest({ url: '/api/unknown', method: 'GET' }));
      expect(res!.status).toBe(404);
    });

    it('returns 400 for malformed note IDs', async () => {
      const router = createApiRouter(store);
      const res = await router.handle(makeRequest({
        url: '/api/notes/<script>', method: 'GET',
      }));
      expect(res!.status).toBe(400);
    });
  });

  describe('CORS preflight', () => {
    it('returns 204 with CORS headers on OPTIONS /api/notes', async () => {
      const router = createApiRouter(store);
      const res = await router.handle(makeRequest({ url: '/api/notes', method: 'OPTIONS' }));
      expect(res!.status).toBe(204);
      expect(res!.headers['access-control-allow-methods']).toContain('GET');
    });
  });

  describe('security headers', () => {
    it('applies security headers to every API response', async () => {
      const router = createApiRouter(store);
      const res = await router.handle(makeRequest());
      expect(res!.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res!.headers['x-content-type-options']).toBe('nosniff');
      expect(res!.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('rate limiting', () => {
    it('returns 429 when the create limit is exceeded', async () => {
      process.env.RATE_LIMIT_CREATE = '1';
      const limiter = createRateLimiter();
      const router = createApiRouter(store, limiter);

      const first = await router.handle(makeRequest());
      expect(first!.status).toBe(201);

      const second = await router.handle(makeRequest());
      expect(second!.status).toBe(429);
      expect((second!.body as { error: string }).error).toBe('Rate limit exceeded');
      expect(second!.headers['retry-after']).toBeDefined();
    });

    it('allows a get request when its own limit is not exceeded', async () => {
      process.env.RATE_LIMIT_READ = '1';
      const limiter = createRateLimiter();
      const router = createApiRouter(store, limiter);

      const created = (await router.handle(makeRequest()))!.body as { noteId: string };
      const res = await router.handle(makeRequest({
        url: `/api/notes/${created.noteId}`, method: 'GET',
      }));
      expect(res!.status).toBe(200);
    });
  });

  describe('response shape', () => {
    it('never leaks the deleteToken on reads', async () => {
      const router = createApiRouter(store);
      const created = (await router.handle(makeRequest()))!.body as { noteId: string };
      const res = await router.handle(makeRequest({
        url: `/api/notes/${created.noteId}`, method: 'GET',
      })) as GenericResponse;
      expect((res.body as Record<string, unknown>).deleteToken).toBeUndefined();
    });
  });
});