# API Handlers — Milestone 4

## Test Files Created

All test files are in place and failing (TDD approach):

1. **createNote.test.ts** — 28 tests
   - Happy path: 201 with noteId/deleteToken
   - Validation: missing/invalid content → 400
   - Payload cap: >100KB → 413
   - Security: HTML sanitization
   - Error handling: store failures → 500
   - Method validation: non-POST → 405

2. **getNote.test.ts** — 19 tests
   - Happy path: 200 with note data (no deleteToken exposed)
   - **CRITICAL**: Uniform 404 for "never existed" vs "expired"
   - Malformed ID validation → 400
   - Method validation: non-GET → 405
   - Error handling: store failures → 500

3. **updateNote.test.ts** — 22 tests
   - Happy path: 200 with { success: true }
   - Uniform 404 for not found / expired
   - Validation: missing/invalid content → 400
   - Payload cap: >100KB → 413
   - Malformed ID validation → 400
   - Method validation: non-PUT/PATCH → 405

4. **deleteNote.test.ts** — 24 tests
   - Happy path: 200 with { success: true }
   - **CRITICAL**: Uniform 404 for all failure modes:
     - Never existed
     - Expired
     - Wrong token
   - Missing token validation → 400
   - Malformed ID validation → 400
   - Method validation: non-DELETE → 405

5. **adapter.test.ts** — 13 tests
   - Request conversion (Cloudflare Workers Request → GenericRequest)
   - Response conversion (GenericResponse → platform Response)
   - CORS: same-origin by default (no Access-Control-Allow-Origin)
   - Error handling: handler crashes → 500, malformed JSON → 400

6. **types.ts** — Generic request/response types
   - GenericRequest: method, params, body, headers
   - GenericResponse: status, body, headers
   - Handler type: (req: GenericRequest) => Promise<GenericResponse>

## Implementation Files Needed

Create these files to make tests pass:

- `src/api/createNote.ts` — export `createCreateNoteHandler(store: NoteStore): Handler`
- `src/api/getNote.ts` — export `createGetNoteHandler(store: NoteStore): Handler`
- `src/api/updateNote.ts` — export `createUpdateNoteHandler(store: NoteStore): Handler`
- `src/api/deleteNote.ts` — export `createDeleteNoteHandler(store: NoteStore): Handler`
- `src/api/adapter.ts` — export `adaptHandler(handler: Handler): (req: any) => Promise<any>`

## Security Requirements

### Uniform Error Responses (CRITICAL)

**getNote**: Must return identical 404 response for:
- Note never existed
- Note expired

**deleteNote**: Must return identical 404 response for:
- Note never existed
- Note expired
- Wrong delete token

This prevents information leakage about note existence/state.

### Other Security Tests

- Payload cap: 100KB hard limit, no silent truncation
- HTML sanitization: strip all `<` and `>` characters
- Malformed ID validation: reject before reaching store
- No information leakage in error messages
- CORS: same-origin by default

## Handler Contract

Each handler factory takes a `NoteStore` and returns a `Handler` function:

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

## Running Tests

```bash
npm test -- src/api/
```

Expected: All tests fail until implementations are created.
