/**
 * getNote API handler — platform-agnostic.
 * GET /notes/:noteId — retrieves a note by ID.
 * CRITICAL: Uniform 404 for not-found and expired (no information leakage).
 */
import type { NoteStore } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse, Handler } from './types';
import { isExpired } from '../core/expiry';
import { calculateExpiry } from '../core/expiry';

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' };

function jsonResponse(status: number, body: unknown): GenericResponse {
  return { status, body, headers: { ...JSON_HEADERS } };
}

const NOT_FOUND_RESPONSE: GenericResponse = jsonResponse(404, { error: 'Not found' });

function isValidNoteId(id: string | undefined): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Factory that creates a getNote handler bound to a specific store.
 */
export function createGetNoteHandler(store: NoteStore): Handler {
  return async (req: GenericRequest): Promise<GenericResponse> => {
    // Method validation
    if (req.method !== 'GET') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    // ID validation
    const noteId = req.params.noteId;
    if (!isValidNoteId(noteId)) {
      return jsonResponse(400, { error: 'Invalid note ID' });
    }

    // Fetch note from store
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

    // Return note data WITHOUT deleteToken
    return jsonResponse(200, {
      id: note.id,
      content: note.content,
      createdAt: note.createdAt,
      expiresAt: calculateExpiry(note.createdAt),
    });
  };
}
