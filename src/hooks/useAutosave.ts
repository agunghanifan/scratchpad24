import { useState, useEffect, useRef } from 'react';
import { updateNote } from '../api/client';

const MAX_BYTES = 100 * 1024;
const DEBOUNCE_MS = 800;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveResult {
  status: SaveStatus;
  error: Error | null;
}

export default function useAutosave(noteId: string, content: string): UseAutosaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;

  useEffect(() => {
    // Don't save empty content
    if (!content) return;
    // Don't save content exceeding 100KB
    if (new TextEncoder().encode(content).length > MAX_BYTES) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        setStatus('saving');
        setError(null);
        await updateNote(noteIdRef.current, contentRef.current);
        setStatus('saved');
      } catch (err) {
        const saveError = err instanceof Error ? err : new Error('Save failed');
        setError(saveError);
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content]);

  return { status, error };
}
