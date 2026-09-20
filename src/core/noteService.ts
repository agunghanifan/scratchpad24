/**
 * Pure business logic for note operations.
 * Platform-agnostic core — no storage implementation details.
 */
import { timingSafeEqual } from 'node:crypto';
import { generateNoteId, generateDeleteToken } from './idGenerator';
import { isExpired } from './expiry';
import type { NoteRecord, NoteStore } from '../storage/NoteStore';

const MAX_PAYLOAD_BYTES = 100 * 1024; // 100KB

/**
 * Sanitizes content to plain text by stripping HTML tags.
 * Removes all < and > characters to prevent XSS.
 */
function sanitizeContent(content: string): string {
  return content.replace(/[<>]/g, '');
}

/**
 * Validates content size against the 100KB payload cap.
 * @throws Error if content exceeds 100KB
 */
function validatePayloadSize(content: string): void {
  const byteLength = new TextEncoder().encode(content).length;
  if (byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(`Content exceeds maximum size of ${MAX_PAYLOAD_BYTES} bytes`);
  }
}

/**
 * Constant-time comparison for delete tokens to prevent timing attacks.
 * Uses crypto.timingSafeEqual for secure comparison.
 */
function safeCompareTokens(a: string, b: string): boolean {
  // Convert to buffers for timing-safe comparison
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  
  // timingSafeEqual requires same length buffers
  if (bufA.length !== bufB.length) {
    // Different lengths - still do a comparison to avoid timing leak
    // Compare bufA against itself (always passes) but return false
    timingSafeEqual(bufA, bufA);
    return false;
  }
  
  // Constant-time comparison
  return timingSafeEqual(bufA, bufB);
}

/**
 * Creates a new note.
 * @param store - The note storage implementation
 * @param content - The note content (will be sanitized)
 * @param idGen - Optional ID generator (defaults to crypto.randomUUID)
 * @param now - Optional timestamp (defaults to Date.now())
 * @returns The note ID and delete token
 * @throws Error if content exceeds 100KB or store.create fails
 */
export async function createNote(
  store: NoteStore,
  content: string,
  idGen: { generateNoteId: () => string; generateDeleteToken: () => string } = {
    generateNoteId,
    generateDeleteToken,
  },
  now?: number
): Promise<{ noteId: string; deleteToken: string }> {
  const sanitized = sanitizeContent(content);
  validatePayloadSize(sanitized);
  
  const noteId = idGen.generateNoteId();
  const deleteToken = idGen.generateDeleteToken();
  const createdAt = now ?? Date.now();
  
  const note: NoteRecord = {
    id: noteId,
    content: sanitized,
    createdAt,
    deleteToken,
  };
  
  await store.create(note);
  
  return { noteId, deleteToken };
}

/**
 * Retrieves a note by ID.
 * Returns null for non-existent, expired, or deleted notes (uniform response).
 */
export async function getNote(
  store: NoteStore,
  id: string,
  now?: number
): Promise<NoteRecord | null> {
  const note = await store.get(id);
  
  if (!note) {
    return null;
  }
  
  if (isExpired(note.createdAt, now)) {
    return null;
  }
  
  return note;
}

/**
 * Updates a note's content.
 * @returns true if updated, false if note doesn't exist or is expired
 * @throws Error if content exceeds 100KB
 */
export async function updateNote(
  store: NoteStore,
  id: string,
  content: string,
  now?: number
): Promise<boolean> {
  const note = await store.get(id);
  
  if (!note) {
    return false;
  }
  
  if (isExpired(note.createdAt, now)) {
    return false;
  }
  
  const sanitized = sanitizeContent(content);
  validatePayloadSize(sanitized);
  
  return await store.update(id, sanitized);
}

/**
 * Deletes a note with constant-time token comparison.
 * @returns true if deleted, false for any failure (uniform response)
 */
export async function deleteNote(
  store: NoteStore,
  id: string,
  deleteToken: string,
  now?: number
): Promise<boolean> {
  const note = await store.get(id);
  
  if (!note) {
    return false;
  }
  
  if (isExpired(note.createdAt, now)) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  if (!safeCompareTokens(note.deleteToken, deleteToken)) {
    return false;
  }
  
  return await store.delete(id);
}
