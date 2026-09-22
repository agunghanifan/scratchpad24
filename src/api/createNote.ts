/**
 * createNote API handler — platform-agnostic.
 * POST /notes — creates a new note with sanitized content.
 */
import type { NoteStore, NoteRecord } from '../storage/NoteStore';
import type { GenericRequest, GenericResponse, Handler } from './types';
import { generateNoteId, generateDeleteToken } from '../core/idGenerator';
import { sanitizeContent } from '../utils/sanitize';
import { MAX_PAYLOAD_BYTES, byteLength } from '../utils/limits';

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' };

function jsonResponse(status: number, body: unknown): GenericResponse {
  return { status, body, headers: { ...JSON_HEADERS } };
}

/**
 * Factory that creates a createNote handler bound to a specific store.
 */
export function createCreateNoteHandler(store: NoteStore): Handler {
  return async (req: GenericRequest): Promise<GenericResponse> => {
    // Method validation
    if (req.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' });
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

    // Payload cap (byte-level, multibyte safe)
    if (byteLength(content) > MAX_PAYLOAD_BYTES) {
      return jsonResponse(413, { error: 'Content exceeds maximum size of 100KB' });
    }

    // Sanitize content
    const sanitized = sanitizeContent(content);

    // Generate IDs and create note
    const noteId = generateNoteId();
    const deleteToken = generateDeleteToken();
    const createdAt = Date.now();

    const note: NoteRecord = {
      id: noteId,
      content: sanitized,
      createdAt,
      deleteToken,
    };

    try {
      await store.create(note);
    } catch {
      return jsonResponse(500, { error: 'Internal server error' });
    }

    return jsonResponse(201, { noteId, deleteToken });
  };
}
