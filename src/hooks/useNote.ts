import { useState, useEffect } from 'react';
import { getNote, type Note } from '../api/client';

interface UseNoteResult {
  note: Note | null;
  loading: boolean;
  error: Error | null;
}

export default function useNote(noteId: string): UseNoteResult {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const fetchNote = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getNote(noteId);
        if (!cancelled) {
          setNote(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Failed to fetch note');
          const errorWithStatus = err as Error & { status?: number };
          // Normalize 404 errors to uniform message
          if (errorWithStatus.status === 404) {
            setError(new Error('Note not found or expired'));
          } else {
            setError(error);
          }
          setNote(null);
          setLoading(false);
        }
      }
    };

    fetchNote();

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  return { note, loading, error };
}
