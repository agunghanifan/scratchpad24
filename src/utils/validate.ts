/**
 * Shared validation helpers.
 */

/**
 * Validates a note ID from a URL path parameter.
 * Accepts non-empty strings of [A-Za-z0-9_-] (max enforced by generator).
 */
export function isValidNoteId(id: string | undefined): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
}