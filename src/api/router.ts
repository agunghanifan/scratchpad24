/**
 * Shared API router — single source of truth for HTTP route matching.
 * Used by the Vite dev plugin (`vite-plugin-api.ts`) and the production
 * Node server (`src/server.ts`).
 *
 * Handles:
 * - /api prefix stripping
 * - URL path → noteId param extraction
 * - Method+path → handler dispatch
 * - Per-IP rate limiting (withRateLimit wrapper)
 * - Security + CORS headers on API responses
 */
import type { NoteStore } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse } from './types';
import { createCreateNoteHandler } from './createNote';
import { createGetNoteHandler } from './getNote';
import { createUpdateNoteHandler } from './updateNote';
import { createDeleteNoteHandler } from './deleteNote';
import { createRateLimiter, withRateLimit, type RateLimiter, type Endpoint } from './rateLimiter';
import { getSecurityHeaders, getCorsHeaders } from './security';
import { isValidNoteId } from '../utils/validate';

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' };

export interface ApiRequest {
  /** Raw URL path, e.g. "/api/notes/abc" or "/notes/abc" */
  url: string;
  method: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface ApiRouter {
  /**
   * Routes an API request. Returns null when the URL is not an API route.
   */
  handle(req: ApiRequest): Promise<GenericResponse | null>;
}

function jsonResponse(status: number, body: unknown): GenericResponse {
  return { status, body, headers: { ...JSON_HEADERS } };
}

const NOT_FOUND_RESPONSE: GenericResponse = jsonResponse(404, { error: 'Not found' });

/**
 * Extracts the noteId param from a stripped path (/notes/abc → "abc").
 */
function extractNoteId(path: string): string | undefined {
  const match = path.match(/^\/notes\/([^/]+)$/);
  return match ? match[1] : undefined;
}

/**
 * Creates a router bound to a store, with optional rate limiter (default: env-configured).
 */
export function createApiRouter(
  store: NoteStore,
  limiter: RateLimiter = createRateLimiter()
): ApiRouter {
  const handlers: Record<Endpoint, (req: GenericRequest) => Promise<GenericResponse>> = {
    createNote: withRateLimit(createCreateNoteHandler(store), limiter, 'createNote'),
    getNote: withRateLimit(createGetNoteHandler(store), limiter, 'getNote'),
    updateNote: withRateLimit(createUpdateNoteHandler(store), limiter, 'updateNote'),
    deleteNote: withRateLimit(createDeleteNoteHandler(store), limiter, 'deleteNote'),
  };

  async function handle(req: ApiRequest): Promise<GenericResponse | null> {
    // Only API routes
    if (!req.url.startsWith('/api')) {
      return null;
    }

    const path = req.url.replace(/^\/api/, '');
    const noteId = extractNoteId(path);
    const params: Record<string, string> = noteId !== undefined ? { noteId } : {};

    const genericReq: GenericRequest = {
      method: req.method,
      params,
      body: req.body,
      headers: req.headers,
    };

    let response: GenericResponse;

    if (path === '/notes' && req.method === 'POST') {
      response = await handlers.createNote(genericReq);
    } else if (noteId !== undefined && isValidNoteId(noteId)) {
      switch (req.method) {
        case 'GET':
          response = await handlers.getNote(genericReq);
          break;
        case 'PUT':
        case 'PATCH':
          response = await handlers.updateNote(genericReq);
          break;
        case 'DELETE':
          response = await handlers.deleteNote(genericReq);
          break;
        default:
          response = jsonResponse(405, { error: 'Method not allowed' });
      }
    } else if (noteId !== undefined) {
      // Malformed noteId — reject before reaching a handler
      response = jsonResponse(400, { error: 'Invalid note ID' });
    } else if (req.method === 'OPTIONS') {
      // CORS preflight
      response = { status: 204, body: null, headers: { ...getCorsHeaders() } };
    } else {
      response = NOT_FOUND_RESPONSE;
    }

    // Security headers on every API response
    return {
      ...response,
      headers: { ...response.headers, ...getSecurityHeaders() },
    };
  }

  return { handle };
}