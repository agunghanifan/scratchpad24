/**
 * Tests for the platform adapter layer — Milestone 4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GenericRequest, GenericResponse, Handler } from './types';

function createMockHandler(response: GenericResponse): Handler {
  return vi.fn(async (_req: GenericRequest) => response);
}

describe('platform adapter', () => {
  let adaptHandler: (handler: Handler) => (platformReq: any) => Promise<any>;

  beforeEach(async () => {
    const mod = await import('./adapter');
    adaptHandler = mod.adaptHandler;
  });

  describe('request conversion', () => {
    it('converts Request to GenericRequest with method', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc-123', { method: 'GET' });
      await adapted(req);
      const genericReq = (handler as any).mock.calls[0][0] as GenericRequest;
      expect(genericReq.method).toBe('GET');
    });

    it('extracts noteId from URL path', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/my-note-id', { method: 'GET' });
      await adapted(req);
      const genericReq = (handler as any).mock.calls[0][0] as GenericRequest;
      expect(genericReq.params.noteId).toBe('my-note-id');
    });

    it('parses JSON body', async () => {
      const handler = createMockHandler({ status: 201, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Hello' }),
      });
      await adapted(req);
      const genericReq = (handler as any).mock.calls[0][0] as GenericRequest;
      expect(genericReq.body).toEqual({ content: 'Hello' });
    });
  });

  describe('response conversion', () => {
    it('returns correct status code', async () => {
      const handler = createMockHandler({
        status: 201, body: { noteId: 'x' },
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Test' }),
      });
      const res = await adapted(req);
      expect(res.status).toBe(201);
    });

    it('serializes body as JSON', async () => {
      const handler = createMockHandler({
        status: 200, body: { id: 'abc', content: 'Hello' },
        headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      const json = await res.json();
      expect(json).toEqual({ id: 'abc', content: 'Hello' });
    });

    it('includes headers from GenericResponse', async () => {
      const handler = createMockHandler({
        status: 200, body: {},
        headers: { 'content-type': 'application/json', 'x-custom': 'value' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('x-custom')).toBe('value');
    });
  });

  describe('CORS: same-origin by default', () => {
    it('does not include CORS headers by default', async () => {
      const handler = createMockHandler({
        status: 200, body: {}, headers: { 'content-type': 'application/json' },
      });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes/abc', { method: 'GET' });
      const res = await adapted(req);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('handles OPTIONS preflight', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'OPTIONS',
        headers: { 'origin': 'https://evil.com' },
      });
      const res = await adapted(req);
      expect(res.status).toBe(204);
    });
  });

  describe('body size protection', () => {
    it('returns 413 when Content-Length header exceeds 200KB', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(201 * 1024), // > 200KB
        },
        body: JSON.stringify({ content: 'x' }),
      });
      const res = await adapted(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toBe('Request body too large');
    });

    it('returns 413 when actual body bytes exceed 200KB (spoofed Content-Length)', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      // Spoof Content-Length to be small, but actual body is large
      const bigContent = 'x'.repeat(201 * 1024);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '10', // Spoofed small value
        },
        body: JSON.stringify({ content: bigContent }),
      });
      const res = await adapted(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toBe('Request body too large');
    });
  });

  describe('invalid URL handling', () => {
    it('returns empty params for invalid URL', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      // Create a request-like object with an invalid URL
      const req = {
        method: 'GET',
        url: 'not-a-valid-url',
        headers: new Headers(),
        text: async () => '',
      } as unknown as Request;
      await adapted(req);
      const genericReq = (handler as any).mock.calls[0][0] as GenericRequest;
      expect(genericReq.params).toEqual({});
    });
  });

  describe('error handling', () => {
    it('returns 500 when handler throws', async () => {
      const handler: Handler = vi.fn(async () => { throw new Error('Crash'); });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Test' }),
      });
      const res = await adapted(req);
      expect(res.status).toBe(500);
    });

    it('returns 400 for malformed JSON', async () => {
      const handler = createMockHandler({ status: 200, body: {}, headers: {} });
      const adapted = adaptHandler(handler);
      const req = new Request('https://example.com/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ invalid json }',
      });
      const res = await adapted(req);
      expect(res.status).toBe(400);
    });
  });
});
