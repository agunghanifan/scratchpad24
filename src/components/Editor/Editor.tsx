import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Editor.module.css';

const MAX_BYTES = 100 * 1024;
const DEBOUNCE_MS = 800;

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: (content: string) => void;
  readOnly?: boolean;
}

function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

function countWords(str: string): number {
  if (!str) return 0;
  return str.split(/\s+/).filter(Boolean).length;
}

export default function Editor({ content, onChange, onSave, readOnly = false }: EditorProps) {
  const [internalContent, setInternalContent] = useState(content);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  // Sync internal state with prop changes
  useEffect(() => {
    setInternalContent(content);
  }, [content]);

  const overCap = getByteLength(internalContent) > MAX_BYTES;

  // Debounced save: fires when content prop changes, resets on each change
  useEffect(() => {
    if (readOnly) return;
    if (overCap) return;
    clearTimeout(timerRef.current!);
    timerRef.current = setTimeout(() => {
      onSave(contentRef.current);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timerRef.current!);
    };
  }, [content, overCap, onSave, readOnly]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const newValue = e.target.value;
      const byteLen = getByteLength(newValue);
      if (byteLen <= MAX_BYTES) {
        setInternalContent(newValue);
        onChange(newValue);
      }
    },
    [onChange, readOnly]
  );

  const charCount = internalContent.length;
  const wordCount = countWords(internalContent);

  return (
    <div className={styles.editor}>
      <label htmlFor="note-content" className={styles.label}>
        Note content
      </label>
      <textarea
        id="note-content"
        className={styles.textarea}
        value={internalContent}
        onChange={handleChange}
        readOnly={readOnly}
        aria-label="Note content"
      />
      <div className={styles.counter}>
        <span aria-live="polite">{charCount} characters</span>
        <span>{wordCount} words</span>
      </div>
      {overCap && (
        <div className={styles.error} role="alert">
          Content exceeds maximum size of 100KB
        </div>
      )}
    </div>
  );
}

