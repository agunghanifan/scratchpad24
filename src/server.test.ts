/**
 * Integration tests for the Node production server — real HTTP requests
 * against createServer() with an in-memory store and a temp dist dir.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from './server';
import type http from 'node:http';
import { InMemoryNoteStore } from './storage/InMemoryNoteStore';

describe('Node production server', () => {
  let server: http.Server;
  let baseUrl: string;
  let distDir: string;

  beforeAll(async () => {
    // Temp dist with a recognizable index.html
    distDir = mkdtempSync(path.join(tmpdir(), 'scratchpad-dist-'));
    writeFileSync(path.join(distDir, 'index.html'), '<!DOCTYPE html><title>ScratchPad24</title>');
    writeFileSync(path.join(distDir, 'app.js'), 'console.log("app");');
    writeFileSync(path.join(distDir, 'style.css'), 'body{}');

    server = createServer(new InMemoryNoteStore(), distDir);
    const { promise: listening, resolve: onListening } = Promise.withResolvers<void>();
    server.listen(0, '127.0.0.1', onListening);
    await listening;
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('server did not bind');
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    const { promise: closed, resolve: onClosed, reject: onCloseError } = Promise.withResolvers<void>();
    server.close((err) => (err ? onCloseError(err) : onClosed()));
    await closed;
    rmSync(distDir, { recursive: true, force: true });
  });

  async function jsonRequest(method: string, urlPath: string, body?: unknown): Promise<Response> {
    return fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  describe('API', () => {
    it('creates, reads, updates, and deletes a note', async () => {
      // Create
      const createRes = await jsonRequest('POST', '/api/notes', { content: 'Hello' });
      expect(createRes.status).toBe(201);
      const { noteId, deleteToken } = await createRes.json() as { noteId: string; deleteToken: string };

      // Read (no token leak)
      const getRes = await jsonRequest('GET', `/api/notes/${noteId}`);
      expect(getRes.status).toBe(200);
      const note = await getRes.json() as { content: string; deleteToken?: string };
      expect(note.content).toBe('Hello');
      expect(note.deleteToken).toBeUndefined();

      // Update
      const updateRes = await jsonRequest('PUT', `/api/notes/${noteId}`, {
        content: 'Updated', deleteToken,
      });
      expect(updateRes.status).toBe(200);

      // Wrong token → uniform 404
      const badUpdate = await jsonRequest('PUT', `/api/notes/${noteId}`, {
        content: 'Hacked', deleteToken: 'wrong',
      });
      expect(badUpdate.status).toBe(404);

      // Delete
      const deleteRes = await jsonRequest('DELETE', `/api/notes/${noteId}`, { deleteToken });
      expect(deleteRes.status).toBe(200);

      // Gone
      const gone = await jsonRequest('GET', `/api/notes/${noteId}`);
      expect(gone.status).toBe(404);
    });

    it('returns 404 for unknown API routes', async () => {
      const res = await jsonRequest('GET', '/api/nope');
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed JSON body', async () => {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      });
      expect(res.status).toBe(400);
    });

    it('rejects oversized bodies with 413', async () => {
      const res = await jsonRequest('POST', '/api/notes', { content: 'x'.repeat(250 * 1024) });
      expect(res.status).toBe(413);
    });

    it('applies security headers to API responses', async () => {
      const res = await jsonRequest('GET', '/api/nope');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    });
  });

  describe('static files', () => {
    it('serves index.html at /', async () => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('ScratchPad24');
    });

    it('serves assets with correct content types', async () => {
      const js = await fetch(`${baseUrl}/app.js`);
      expect(js.status).toBe(200);
      expect(js.headers.get('content-type')).toContain('javascript');

      const css = await fetch(`${baseUrl}/style.css`);
      expect(css.status).toBe(200);
      expect(css.headers.get('content-type')).toContain('text/css');
    });

    it('falls back to index.html for SPA routes', async () => {
      const res = await fetch(`${baseUrl}/n/some-note-id`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('ScratchPad24');
    });

    it('returns 404 for missing files without SPA fallback', async () => {
      const res = await fetch(`${baseUrl}/missing.txt`);
      expect(res.status).toBe(404);
    });
  });
});