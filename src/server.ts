/**
 * Node production server.
 * Serves the built frontend (dist/) and the /api/* routes via the shared
 * API router with in-memory storage and per-IP rate limiting.
 *
 * Run: npm run build && npm start  (or node dist-server/server.js)
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { InMemoryNoteStore } from './storage/InMemoryNoteStore';
import { createApiRouter } from './api/router';
import { getSecurityHeaders } from './api/security';
import type { NoteStore } from './storage/NoteStore';

const PORT = parseInt(process.env.PORT || '3000', 10);
// Slightly above the 100KB payload cap for safety (mirrors src/api/adapter.ts)
const MAX_BODY_BYTES = 200 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function applySecurityTo(res: ServerResponse): void {
  for (const [key, value] of Object.entries(getSecurityHeaders())) {
    res.setHeader(key, value);
  }
}

async function readBody(req: IncomingMessage): Promise<{ body?: unknown; status?: number; error?: string }> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      return { status: 413, error: 'Request body too large' };
    }
    chunks.push(buf);
  }

  const text = Buffer.concat(chunks).toString('utf-8');
  if (text.length === 0) {
    return {};
  }

  try {
    return { body: JSON.parse(text) };
  } catch {
    return { status: 400, error: 'Invalid JSON' };
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  applySecurityTo(res);
  res.end(JSON.stringify(body));
}

/**
 * Serves static files from the build directory with SPA fallback.
 */
async function serveStatic(rootDir: string, res: ServerResponse, url: string): Promise<void> {
  // Only serve GET/HEAD requests; other methods → 405 for a real path, else 404
  const pathname = url.split('?')[0];

  try {
    const filePath = path.join(rootDir, pathname === '/' ? 'index.html' : pathname);
    // Prevent path traversal outside the build directory
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(rootDir))) {
      writeJson(res, 403, { error: 'Forbidden' });
      return;
    }

    const data = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.statusCode = 200;
    res.setHeader('content-type', CONTENT_TYPES[ext] || 'application/octet-stream');
    applySecurityTo(res);
    res.end(data);
} catch {
    // SPA fallback only for non-file-looking paths (e.g. /n/:id, /privacy).
    // Explicit file requests (with extension) must 404 on missing files.
    const looksLikeFile = /\/[^/]+\.[a-zA-Z0-9]+$/.test(pathname);
    if (looksLikeFile) {
      writeJson(res, 404, { error: 'Not found' });
      return;
    }
    // Fall back to index.html (SPA routing)
    try {
      const index = await readFile(path.join(rootDir, 'index.html'));
      res.statusCode = 200;
      res.setHeader('content-type', CONTENT_TYPES['.html']);
      applySecurityTo(res);
      res.end(index);
    } catch {
      writeJson(res, 404, { error: 'Not found' });
    }
  }
}

/**
 * Creates the HTTP server without listening — tests bind/unbind themselves.
 */
export function createServer(
  store: NoteStore = new InMemoryNoteStore(),
  distDir = path.resolve('dist')
): http.Server {
  const router = createApiRouter(store);

  return createHttpServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // API routes
    if (url.startsWith('/api')) {
      let body: unknown;
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const result = await readBody(req);
        if (result.status && result.error) {
          writeJson(res, result.status, { error: result.error });
          return;
        }
        body = result.body;
      }

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key.toLowerCase()] = value;
        }
      }

      const result = await router.handle({ url, method, headers, body });
      if (result) {
        res.statusCode = result.status;
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
        if (result.body !== null && result.body !== undefined) {
          res.end(JSON.stringify(result.body));
        } else {
          res.end();
        }
      } else {
        writeJson(res, 404, { error: 'Not found' });
      }
      return;
    }

    // Static files + SPA fallback
    await serveStatic(distDir, res, url);
  });
}

export function startServer(
  store: NoteStore = new InMemoryNoteStore(),
  distDir = path.resolve('dist'),
  port = PORT
): http.Server {
  const server = createServer(store, distDir);
  server.listen(port, () => {
    console.log(`ScratchPad24 server listening on http://localhost:${port}`);
  });
  return server;
}

// Start only when run directly (not when imported by tests)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  startServer();
}