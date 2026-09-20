/**
 * Cloudflare KV implementation of NoteStore.
 * Uses KV's built-in TTL (expiration) for 24-hour note expiry.
 */
import type { NoteRecord, NoteStore } from './NoteStore';

const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60;

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

function cloneNote(note: NoteRecord): NoteRecord {
  return { ...note };
}

export class KvNoteStore implements NoteStore {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    if (!kv) {
      throw new Error('KVNamespace binding is required');
    }
    this.kv = kv;
  }

  async create(note: NoteRecord): Promise<void> {
    // Check for duplicate ID first
    const existing = await this.kv.get(note.id);
    if (existing !== null) {
      throw new Error(`Note with id '${note.id}' already exists (duplicate ID collision)`);
    }

    // Store as JSON with 24h TTL
    const noteCopy = cloneNote(note);
    await this.kv.put(note.id, JSON.stringify(noteCopy), {
      expirationTtl: TWENTY_FOUR_HOURS_SECONDS,
    });
  }

  async get(id: string): Promise<NoteRecord | null> {
    const value = await this.kv.get(id);
    if (value === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as NoteRecord;
      return cloneNote(parsed);
    } catch {
      // Malformed JSON - return null defensively
      return null;
    }
  }

  async update(id: string, content: string): Promise<boolean> {
    // Get existing note
    const existing = await this.get(id);
    if (!existing) {
      return false;
    }

    // Update content, preserve other fields
    existing.content = content;

    // Re-store with 24h TTL
    await this.kv.put(id, JSON.stringify(existing), {
      expirationTtl: TWENTY_FOUR_HOURS_SECONDS,
    });

    return true;
  }

  async delete(id: string): Promise<boolean> {
    // Check if exists first
    const existing = await this.kv.get(id);
    const existed = existing !== null;

    // Call delete (will throw if KV error)
    await this.kv.delete(id);
    
    return existed;
  }

  async exists(id: string): Promise<boolean> {
    const value = await this.kv.get(id);
    return value !== null;
  }
}