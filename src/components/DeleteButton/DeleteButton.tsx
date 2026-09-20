import { useState, useEffect } from 'react';
import styles from './DeleteButton.module.css';

interface DeleteButtonProps {
  onDelete: () => void;
}

export default function DeleteButton({ onDelete }: DeleteButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  const handleConfirm = () => {
    onDelete();
    setShowDialog(false);
  };

  const handleCancel = () => {
    setShowDialog(false);
  };

  useEffect(() => {
    if (!showDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDialog(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDialog]);

  if (showDialog) {
    return (
      <div
        className={styles.dialog}
        role="dialog"
        aria-labelledby="delete-dialog-title"
      >
        <h2 id="delete-dialog-title" className={styles.dialogTitle}>
          Confirm Delete
        </h2>
        <p className={styles.dialogText}>
          This action cannot be undone. The note will be permanently deleted.
        </p>
        <div className={styles.dialogActions}>
          <button onClick={handleConfirm} className={styles.confirmButton}>
            Confirm
          </button>
          <button onClick={handleCancel} className={styles.cancelButton}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowDialog(true)}
      className={styles.deleteButton}
    >
      Delete now
    </button>
  );
}
