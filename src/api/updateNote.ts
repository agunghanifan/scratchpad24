/**
 * updateNote API handler — platform-agnostic.
 * PUT/PATCH /notes/:noteId — updates a note's content.
 * CRITICAL: Uniform 404 for not-found, expired, and wrong-token (no information leakage).
 */
import type { NoteStore } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse, Handler } from './types';
import { updateNote } from '../core/noteService';
import { MAX_PAYLOAD_BYTES, byteLength } from '../utils/limits';
import { isValidNoteId } from '../utils/validate';

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' };

function jsonResponse(status: number, body: unknown): GenericResponse {
  return { status, body, headers: { ...JSON_HEADERS } };
}

const NOT_FOUND_RESPONSE: GenericResponse = jsonResponse(404, { error: 'Not found' });

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

    // Extract and validate delete token
    const deleteToken = extractDeleteToken(req);
    if (!deleteToken || deleteToken.trim().length === 0) {
      return jsonResponse(400, { error: 'Delete token is required' });
    }

    // Delegate to core service: uniform 404 for not-found, expired,
    // and wrong-token (no information leakage)
    try {
      const updated = await updateNote(store, noteId!, content, deleteToken);
      if (!updated) {
        return NOT_FOUND_RESPONSE;
      }
    } catch {
      return jsonResponse(500, { error: 'Internal server error' });
    }

    return jsonResponse(200, { success: true });
  };
}
