/**
 * Platform-agnostic types for API handlers.
 * These define the generic request/response format that handlers use,
 * independent of any specific platform (Cloudflare Workers, Vercel, Express, etc.).
 */

/**
 * Generic request format used by all handlers.
 * Platform adapters convert platform-specific requests to this format.
 */
export interface GenericRequest {
  /** HTTP method (GET, POST, PUT, PATCH, DELETE) */
  method: string;
  /** URL path parameters (e.g., { noteId: "abc-123" }) */
  params: Record<string, string>;
  /** Parsed JSON body (platform adapter is responsible for parsing) */
  body: unknown;
  /** HTTP headers (case-insensitive keys, adapter should normalize) */
  headers: Record<string, string | undefined>;
}

/**
 * Generic response format returned by all handlers.
 * Platform adapters convert this to platform-specific responses.
 */
export interface GenericResponse {
  /** HTTP status code */
  status: number;
  /** Response body (will be JSON-serialized by adapter) */
  body: unknown;
  /** Response headers */
  headers: Record<string, string>;
}

/**
 * Handler function signature.
 * Each handler factory returns a function matching this type.
 */
export type Handler = (req: GenericRequest) => Promise<GenericResponse>;
