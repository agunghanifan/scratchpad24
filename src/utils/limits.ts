/**
 * Shared limits for note content.
 * Single source of truth for the 100KB payload cap.
 */

export const MAX_PAYLOAD_BYTES = 100 * 1024; // 100KB

/**
 * Byte-length of a string (multibyte-safe via UTF-8 encoding).
 */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}