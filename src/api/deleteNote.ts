/**
 * deleteNote API handler — platform-agnostic.
 * DELETE /notes/:noteId — deletes a note with token verification.
 * CRITICAL: Uniform 404 for not-found, expired, and wrong-token (no information leakage).
 */
import type { NoteStore } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse, Handler } from './types';
import { isExpired } from '../core/expiry';

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

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' };

function jsonResponse(status: number, body: unknown): GenericResponse {
  return { status, body, headers: { ...JSON_HEADERS } };
}

const NOT_FOUND_RESPONSE: GenericResponse = jsonResponse(404, { error: 'Not found' });

function isValidNoteId(id: string | undefined): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
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
 * Factory that creates a deleteNote handler bound to a specific store.
 */
export function createDeleteNoteHandler(store: NoteStore): Handler {
  return async (req: GenericRequest): Promise<GenericResponse> => {
    // Method validation
    if (req.method !== 'DELETE') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    // ID validation
    const noteId = req.params.noteId;
    if (!isValidNoteId(noteId)) {
      return jsonResponse(400, { error: 'Invalid note ID' });
    }

    // Token validation
    const deleteToken = extractDeleteToken(req);
    if (!deleteToken || deleteToken.trim().length === 0) {
      return jsonResponse(400, { error: 'Delete token is required' });
    }

    // Fetch note to check existence, expiry, and token
    let note;
    try {
      note = await store.get(noteId!);
    } catch {
      return jsonResponse(500, { error: 'Internal server error' });
    }

    // Uniform 404: treat not-found, expired, and wrong-token identically
    // CRITICAL: Use constant-time comparison to prevent timing attacks
    if (!note || isExpired(note.createdAt) || !safeCompareTokens(note.deleteToken, deleteToken)) {
      return NOT_FOUND_RESPONSE;
    }

    // Delete note
    try {
      await store.delete(noteId!);
    } catch {
      return jsonResponse(500, { error: 'Internal server error' });
    }

    return jsonResponse(200, { success: true });
  };
}
