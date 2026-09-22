# API Handlers

Platform-agnostic serverless handlers for note CRUD. The core (in `../core/noteService.ts`) holds pure business logic; these handlers are thin factories that bind a `NoteStore` to HTTP semantics. The adapter bridges generic handlers to a specific platform's `Request`/`Response` (Cloudflare Workers, Vercel, Netlify, etc.).

## Files

| File | Exports | Purpose |
|------|---------|---------|
| `createNote.ts` | `createCreateNoteHandler(store)` | `POST /notes` → 201 `{ noteId, deleteToken }`; validation 400; >100KB 413; non-POST 405 |
| `getNote.ts` | `createGetNoteHandler(store)` | `GET /notes/:noteId` → 200 note (no `deleteToken`); uniform 404 for never-existed/expired |
| `updateNote.ts` | `createUpdateNoteHandler(store)` | `PUT|PATCH /notes/:noteId` → 200 `{ success: true }`; uniform 404 |
| `deleteNote.ts` | `createDeleteNoteHandler(store)` | `DELETE /notes/:noteId` → 200 `{ success: true }`; uniform 404 for never-existed/expired/wrong token |
| `adapter.ts` | `adaptHandler(handler)` | Converts `Request` ↔ `GenericRequest`, `GenericResponse` → `Response`; CORS preflight; 500 on handler crash |
| `client.ts` | `createNote`, `getNote`, `updateNote`, `deleteNote` | Frontend fetch client |
| `cron.ts` | `cleanupExpired(env)` | Hourly sweep of expired notes not caught by KV TTL |
| `rateLimiter.ts` | `createRateLimiter`, `withRateLimit`, `extractClientIP` | Per-IP, per-endpoint limits from env config |
| `security.ts` | `getSecurityHeaders`, `getCorsHeaders`, `applySecurityHeaders` | Security + CORS headers |
| `types.ts` | `GenericRequest`, `GenericResponse`, `Handler` | Shared handler contract |

## Handler Contract

```typescript
type Handler = (req: GenericRequest) => Promise<GenericResponse>;

interface GenericRequest {
  method: string;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string | undefined>;
}

interface GenericResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}
```

## Security Invariants

- **Uniform 404s** — `getNote` returns the identical 404 whether the note never existed or expired; `deleteNote` also collapses wrong tokens into the same 404. No information leakage about note existence or state.
- **Payload cap** — 100KB hard limit, rejected with 413, never truncated.
- **Sanitization** — all `<` and `>` stripped from content.
- **Malformed IDs** — rejected with 400 before reaching the store.
- **Constant-time token compare** — delete tokens compared with `crypto.timingSafeEqual`.
- **CORS** — same-origin by default; no wildcard `Access-Control-Allow-Origin`.

## Running Tests

```bash
npm test -- src/api/
```

All handler tests pass (create 28, get 19, update 22, delete 24, adapter 13, plus cron and client).