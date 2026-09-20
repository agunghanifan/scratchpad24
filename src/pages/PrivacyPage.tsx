import { useNavigate } from 'react-router-dom';
import styles from './PrivacyPage.module.css';

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>
      <article className={styles.content}>
        <h1 className={styles.title}>Privacy & Terms</h1>
        
        <section className={styles.section}>
          <h2>No Accounts</h2>
          <p>
            ScratchPad24 requires no account, no login, and no session. 
            You can start using the service immediately without providing 
            any personal information.
          </p>
        </section>

        <section className={styles.section}>
          <h2>No PII Collection</h2>
          <p>
            We do not collect any personally identifiable information. 
            There are no analytics, no tracking, and no third-party 
            scripts monitoring your activity.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Ephemeral Storage</h2>
          <p>
            All notes are stored temporarily and are permanently deleted 
            24 hours after creation. There is no way to extend this 
            expiration period. Once a note expires, it cannot be recovered.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Accepted Risk</h2>
          <p>
            Anyone with the exact link can view, edit, or delete the note. 
            The URL is the only credential — keep it secret. We recommend 
            not sharing sensitive information through this service.
          </p>
        </section>

        <section className={styles.section}>
          <h2>No Content Moderation</h2>
          <p>
            Notes are anonymous and ephemeral, with no content moderation 
            by design. Users are responsible for the content they create 
            and share.
          </p>
        </section>

        <section className={styles.disclaimer}>
          <h2>Disclaimer</h2>
          <p>
            This is placeholder language for an MVP and is not a substitute 
            for actual legal review.
          </p>
        </section>
      </article>
    </div>
  );
}