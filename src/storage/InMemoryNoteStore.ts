/**
 * In-memory implementation of NoteStore for development and testing.
 * Uses a Map for O(1) lookups. Data is lost on process restart.
 */
import type { NoteRecord, NoteStore } from './NoteStore';
import { isExpired } from '../core/expiry';

function cloneNote(note: NoteRecord): NoteRecord {
  return { ...note };
}

export class InMemoryNoteStore implements NoteStore {
  private notes: Map<string, NoteRecord> = new Map();

  async create(note: NoteRecord): Promise<void> {
    if (this.notes.has(note.id)) {
      throw new Error(`Note with id '${note.id}' already exists (duplicate ID collision)`);
    }
    this.notes.set(note.id, cloneNote(note));
  }

  async get(id: string): Promise<NoteRecord | null> {
    const note = this.notes.get(id);
    return note ? cloneNote(note) : null;
  }

  async update(id: string, content: string): Promise<boolean> {
    const note = this.notes.get(id);
    if (!note) {
      return false;
    }
    note.content = content;
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.notes.has(id);
  }

  async cleanupExpired(): Promise<number> {
    let removed = 0;
    for (const [id, note] of this.notes) {
      if (isExpired(note.createdAt)) {
        this.notes.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
