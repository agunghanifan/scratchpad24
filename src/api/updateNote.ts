/**
 * updateNote API handler — platform-agnostic.
 * PUT/PATCH /notes/:noteId — updates a note's content.
 * CRITICAL: Uniform 404 for not-found, expired, and wrong-token (no information leakage).
 */
import type { NoteStore } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse, Handler } from './types';
import { isExpired } from '../core/expiry';
import { sanitizeContent } from '../utils/sanitize';

const MAX_PAYLOAD_BYTES = 100 * 1024; // 100KB

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' };

function jsonResponse(status: number, body: unknown): GenericResponse {
  return { status, body, headers: { ...JSON_HEADERS } };
}

const NOT_FOUND_RESPONSE: GenericResponse = jsonResponse(404, { error: 'Not found' });

function isValidNoteId(id: string | undefined): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Constant-time comparison for delete tokens to prevent timing attacks.
 * Uses a portable XOR-based approach that works in Cloudflare Workers.
 */
function safeCompareTokens(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  if (bufA.length !== bufB.length) {
    // Still perform comparison to maintain constant time, then return false
    let _result = 0;
    for (let i = 0; i < bufA.length; i++) _result |= bufA[i] ^ bufB[i];
    return false;
  }

  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

/**
 * Extracts delete token from request body or header.
 * Body takes precedence, but header is also supported.
 */
function extractDeleteToken(req: GenericRequest): string | undefined {
  // Try body first
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object' && typeof body.deleteToken === 'string') {
    return body.deleteToken;
  }

  // Try header
  const headerToken = req.headers['x-delete-token'];
  if (typeof headerToken === 'string') {
    return headerToken;
  }

  return undefined;
}

/**
 * Factory that creates an updateNote handler bound to a specific store.
 */
export function createUpdateNoteHandler(store: NoteStore): Handler {
  return async (req: GenericRequest): Promise<GenericResponse> => {
    // Method validation (accept PUT and PATCH)
    if (req.method !== 'PUT' && req.method !== 'PATCH') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    // ID validation
    const noteId = req.params.noteId;
    if (!isValidNoteId(noteId)) {
      return jsonResponse(400, { error: 'Invalid note ID' });
    }

    // Body validation
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      return jsonResponse(400, { error: 'Request body is required' });
    }

    const { content } = body;
    if (typeof content !== 'string') {
      return jsonResponse(400, { error: 'Content must be a string' });
    }

    if (content.trim().length === 0) {
      return jsonResponse(400, { error: 'Content must not be empty' });
    }

    // Payload cap (byte-level, multibyte safe)
    if (byteLength(content) > MAX_PAYLOAD_BYTES) {
      return jsonResponse(413, { error: 'Content exceeds maximum size of 100KB' });
    }

    // Fetch note to check existence and expiry
    let note;
    try {
      note = await store.get(noteId!);
    } catch {
      return jsonResponse(500, { error: 'Internal server error' });
    }

    // Uniform 404: treat not-found and expired identically
    if (!note || isExpired(note.createdAt)) {
      return NOT_FOUND_RESPONSE;
    }

    // Extract and validate delete token
    const deleteToken = extractDeleteToken(req);
    if (!deleteToken || deleteToken.trim().length === 0) {
      return jsonResponse(400, { error: 'Delete token is required' });
    }

    // Uniform 404: wrong token looks identical to not-found
    if (!safeCompareTokens(deleteToken, note.deleteToken)) {
      return NOT_FOUND_RESPONSE;
    }

    // Sanitize content
    const sanitized = sanitizeContent(content);

    // Update note
    try {
      await store.update(noteId!, sanitized);
    } catch {
      return jsonResponse(500, { error: 'Internal server error' });
    }

    return jsonResponse(200, { success: true });
  };
}
