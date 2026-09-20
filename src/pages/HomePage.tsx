import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNote } from '../api/client';
import styles from './HomePage.module.css';

export default function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await createNote('');
      localStorage.setItem(`deleteToken:${result.noteId}`, result.deleteToken);
      navigate(`/n/${result.noteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>
          ScratchPad24 — A distraction-free, 24-hour text pad
        </h1>
        <p className={styles.description}>
          No login required. Notes auto-expire after one day.
        </p>
      </div>
      <button
        onClick={handleCreate}
        disabled={loading}
        className={styles.createButton}
      >
        {loading ? 'Creating...' : 'Start a new pad'}
      </button>
      {error && <div className={styles.error}>Error: {error}</div>}
      <footer className={styles.footer}>
        <a href="/privacy" className={styles.footerLink}>Privacy & Terms</a>
      </footer>
    </div>
  );
}
