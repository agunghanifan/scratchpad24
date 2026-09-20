import { useState, useEffect } from 'react';
import styles from './ExpiryBanner.module.css';

interface ExpiryBannerProps {
  createdAt: number;
  expiresAt: number;
}

function formatRemaining(expiresAt: number): string {
  const remaining = Math.max(0, expiresAt - Date.now());
  
  if (remaining === 0) {
    return 'Expired';
  }
  
  const totalMinutes = Math.floor(remaining / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `Expires in ${hours}h ${minutes}m`;
}

export default function ExpiryBanner({ createdAt: _createdAt, expiresAt }: ExpiryBannerProps) {
  const [display, setDisplay] = useState(() => formatRemaining(expiresAt));

  useEffect(() => {
    const update = () => {
      setDisplay(formatRemaining(expiresAt));
    };
    
    update();
    const interval = setInterval(update, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = display === 'Expired';

  return (
    <div
      className={`${styles.banner} ${isExpired ? styles.expired : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Expires"
    >
      {display}
    </div>
  );
}
