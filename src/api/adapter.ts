/**
 * Platform adapter layer — converts platform-specific requests/responses
 * to/from the generic handler format.
 * 
 * This adapter is designed for Cloudflare Workers / Fetch API environments
 * but can be extended for other platforms.
 */
import type { GenericRequest, GenericResponse, Handler } from './types';
import { getCorsHeaders, applySecurityHeaders } from './security';

// Maximum request body size: 200KB (slightly above the 100KB payload cap for safety)
const MAX_BODY_BYTES = 200 * 1024;

/**
 * Extracts noteId from URL path.
 * Expected patterns:
 * - /notes/:noteId → { noteId: '...' }
 * - /notes → {}
 * - /notes/ → {}
 */
function extractParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Match /notes/:noteId pattern
    const match = pathname.match(/^\/notes\/([^/]+)$/);
    if (match && match[1]) {
      return { noteId: match[1] };
    }
    
    return {};
  } catch {
    return {};
  }
}

/**
 * Adapts a generic handler to work with platform-specific Request/Response.
 * Handles:
 * - Request → GenericRequest conversion
 * - JSON body parsing
 * - OPTIONS preflight (204)
 * - GenericResponse → Response conversion
 * - Error handling (500 for crashes, 400 for malformed JSON)
 */
export function adaptHandler(handler: Handler): (platformReq: Request) => Promise<Response> {
  return async (platformReq: Request): Promise<Response> => {
    // Handle OPTIONS preflight
    if (platformReq.method === 'OPTIONS') {
      const preflightHeaders = new Headers();
      // CORS headers for preflight
      const corsHeaders = getCorsHeaders();
      for (const [key, value] of Object.entries(corsHeaders)) {
        preflightHeaders.set(key, value);
      }
      // Security headers on preflight too
      applySecurityHeaders(preflightHeaders);
      return new Response(null, {
        status: 204,
        headers: preflightHeaders,
      });
    }

    // Extract params from URL
    const params = extractParams(platformReq.url);

    // CRITICAL: Check body size BEFORE reading to prevent memory exhaustion attacks
    const contentLength = platformReq.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > MAX_BODY_BYTES) {
        const errorHeaders = new Headers();
        errorHeaders.set('content-type', 'application/json');
        applySecurityHeaders(errorHeaders);
        return new Response(
          JSON.stringify({ error: 'Request body too large' }),
          {
            status: 413,
            headers: errorHeaders,
          }
        );
      }
    }

    // Parse JSON body if present
    let body: unknown = undefined;
    const contentType = platformReq.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const text = await platformReq.text();
        
        // Double-check actual body size (Content-Length can be spoofed/missing)
        if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
          const errorHeaders = new Headers();
          errorHeaders.set('content-type', 'application/json');
          applySecurityHeaders(errorHeaders);
          return new Response(
            JSON.stringify({ error: 'Request body too large' }),
            {
              status: 413,
              headers: errorHeaders,
            }
          );
        }
        
        if (text.length > 0) {
          body = JSON.parse(text);
        }
      } catch {
        // Malformed JSON
        const errorHeaders = new Headers();
        errorHeaders.set('content-type', 'application/json');
        applySecurityHeaders(errorHeaders);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON' }),
          {
            status: 400,
            headers: errorHeaders,
          }
        );
      }
    }

    // Convert headers to Record<string, string>
    const headers: Record<string, string> = {};
    platformReq.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Build GenericRequest
    const genericReq: GenericRequest = {
      method: platformReq.method,
      params,
      body,
      headers,
    };

    // Call handler
    let genericRes: GenericResponse;
    try {
      genericRes = await handler(genericReq);
    } catch (error) {
      // Handler crashed
      genericRes = {
        status: 500,
        body: { error: 'Internal server error' },
        headers: { 'content-type': 'application/json' },
      };
    }

    // Convert GenericResponse to Response
    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(genericRes.headers)) {
      responseHeaders.set(key, value);
    }
    // Apply security headers to ALL responses (success and error)
    applySecurityHeaders(responseHeaders);

    // 204/205/304 responses must not have a body per the Fetch spec
    const nullBodyStatuses = [204, 205, 304];
    const responseBody = nullBodyStatuses.includes(genericRes.status)
      ? null
      : JSON.stringify(genericRes.body);

    return new Response(
      responseBody,
      {
        status: genericRes.status,
        headers: responseHeaders,
      }
    );
  };
}
