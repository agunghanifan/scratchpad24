import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useNote from '../hooks/useNote';
import useAutosave from '../hooks/useAutosave';
import { deleteNote } from '../api/client';
import Editor from '../components/Editor/Editor';
import ExpiryBanner from '../components/ExpiryBanner/ExpiryBanner';
import DeleteButton from '../components/DeleteButton/DeleteButton';
import styles from './NotePage.module.css';

export default function NotePage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const deleteToken = localStorage.getItem('deleteToken:' + noteId) || '';
  const isOwner = deleteToken.length > 0;
  const { note, loading, error } = useNote(noteId || '');
  const [content, setContent] = useState(note?.content ?? '');
  const { status: saveStatus } = useAutosave(noteId || '', content, deleteToken || null);

  useEffect(() => {
    if (note) {
      setContent(note.content);
    }
  }, [note]);

  const handleDelete = async () => {
    const deleteToken = localStorage.getItem(`deleteToken:${noteId}`)!;
    await deleteNote(noteId!, deleteToken);
    navigate('/');
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorContent}>
          <p>Note not found or expired</p>
          <Link to="/" className={styles.homeLink}>Go to Home</Link>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className={styles.error}>
        <div className={styles.errorContent}>
          <p>Note not found</p>
          <Link to="/" className={styles.homeLink}>Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ExpiryBanner createdAt={note.createdAt} expiresAt={note.expiresAt} />
      <Editor
        content={content}
        onChange={setContent}
        onSave={setContent}
        readOnly={!isOwner}
      />
      <div className={styles.actions}>
        <button onClick={handleCopyLink} className={styles.copyButton}>
          Copy link
        </button>
        {isOwner && <DeleteButton onDelete={handleDelete} />}
      </div>
      <p className={styles.warning}>
        {isOwner ? 'Warning: Anyone with this link can view this note' : 'This note is read-only. Only the creator can edit or delete it.'}
      </p>
      {saveStatus === 'saving' && <div className={styles.status}>Saving...</div>}
      {saveStatus === 'saved' && <div className={styles.status}>Saved</div>}
      {saveStatus === 'error' && <div className={styles.status}>Save failed</div>}
      <footer className={styles.footer}>
        <a href="/privacy" className={styles.footerLink}>Privacy & Terms</a>
      </footer>
    </div>
  );
}

