/**
 * Cron Trigger handler for cleaning up expired notes.
 * While KV handles TTL automatically, this provides a safety net
 * and metrics for monitoring.
 */
import { isExpired } from '../core/expiry';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

interface NoteRecord {
  id: string;
  content: string;
  createdAt: number;
  deleteToken: string;
}

/**
 * Cleans up expired notes from KV storage.
 * @param env - Environment object with NOTES_KV binding
 * @returns Count of deleted notes
 */
export async function cleanupExpired(env: { NOTES_KV: KVNamespace }): Promise<number> {
  const kv = env.NOTES_KV;
  
  // List all keys
  const { keys } = await kv.list();
  
  let deletedCount = 0;
  
  // Check each key
  for (const { name: key } of keys) {
    const value = await kv.get(key);
    
    let note: NoteRecord;
    try {
      note = JSON.parse(value!) as NoteRecord;
    } catch {
      // Malformed JSON or null value - skip this entry
      continue;
    }
    
    // Check if note is expired
    if (isExpired(note.createdAt)) {
      await kv.delete(key);
      deletedCount++;
    }
  }
  
  return deletedCount;
}