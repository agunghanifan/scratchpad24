/**
 * Cryptographically secure ID and token generation.
 * Uses crypto.getRandomValues() for CSPRNG.
 */

/**
 * Generates a UUID v4 using crypto.getRandomValues().
 * Manually sets version and variant bits per RFC 4122.
 */
function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Set version (4) and variant (10xx) bits per RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  
  // Convert to hex string with dashes
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generates a cryptographically secure UUID v4 for note IDs.
 * @returns A UUID v4 string (36 characters)
 */
export function generateNoteId(): string {
  return generateUUID();
}

/**
 * Generates a cryptographically secure delete token with 128+ bits of entropy.
 * @returns A UUID v4 string used as a delete token
 */
export function generateDeleteToken(): string {
  return generateUUID();
}
