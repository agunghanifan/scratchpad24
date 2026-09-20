/**
 * Expiry calculation and validation for notes.
 * Notes expire 24 hours after creation. No extension possible.
 */

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates the expiry timestamp (createdAt + 24 hours).
 * Pure function, independent of current time.
 */
export function calculateExpiry(createdAt: number): number {
  return createdAt + TWENTY_FOUR_HOURS_MS;
}

/**
 * Checks if a note has expired.
 * @param createdAt - Creation timestamp in milliseconds
 * @param now - Current timestamp (defaults to Date.now())
 * @returns true if now >= createdAt + 24h
 */
export function isExpired(createdAt: number, now?: number): boolean {
  const currentTime = now ?? Date.now();
  return currentTime >= calculateExpiry(createdAt);
}

/**
 * Calculates milliseconds remaining until expiry.
 * @param createdAt - Creation timestamp in milliseconds
 * @param now - Current timestamp (defaults to Date.now())
 * @returns Milliseconds remaining, clamped to 0 (never negative)
 */
export function timeRemaining(createdAt: number, now?: number): number {
  const currentTime = now ?? Date.now();
  const expiry = calculateExpiry(createdAt);
  return Math.max(0, expiry - currentTime);
}

/**
 * Formats the remaining time as a human-readable string.
 * @param createdAt - Creation timestamp in milliseconds
 * @param now - Current timestamp (defaults to Date.now())
 * @returns Formatted string like "23h 12m" or "0h 0m" when expired
 */
export function formatTimeRemaining(createdAt: number, now?: number): string {
  const remaining = timeRemaining(createdAt, now);
  
  if (remaining === 0) {
    return '0h 0m';
  }
  
  const totalMinutes = Math.floor(remaining / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}h ${minutes}m`;
}
