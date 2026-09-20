/**
 * Pluggable storage interface for notes.
 * Platform-agnostic — implementations can use in-memory, KV, Redis, etc.
 */

export interface NoteRecord {
  id: string;
  content: string;
  createdAt: number;
  deleteToken: string;
}

export interface NoteStore {
  create(note: NoteRecord): Promise<void>;
  get(id: string): Promise<NoteRecord | null>;
  update(id: string, content: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}
