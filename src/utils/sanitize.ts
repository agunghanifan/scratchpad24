/**
 * HTML sanitization utilities for plain text content.
 * Strips HTML tags and dangerous characters to prevent XSS.
 */

/**
 * Sanitizes content by removing all HTML tags and < > characters.
 * This is a conservative approach that removes any potential HTML/XSS vectors.
 * @param content - Raw text content
 * @returns Sanitized plain text with no HTML
 */
export function sanitizeContent(content: string): string {
  // Remove all < and > characters to prevent any HTML injection
  return content.replace(/[<>]/g, '');
}
