# ScratchPad24

A distraction-free text pad with **no accounts, no login, no tracking**. Notes auto-expire 24 hours after creation and are permanently deleted.

## Features

- **Zero friction** — no sign-up, no login, no session. Click and start typing.
- **24-hour auto-expiry** — notes are permanently deleted after 24 hours. No extension possible.
- **Plain text only** — no rich text, no markdown rendering, no HTML. Pure distraction-free writing.
- **Auto-save** — changes are saved automatically as you type.
- **Live counters** — character and word count displayed in real time.
- **100 KB hard cap** — inline error if exceeded, no silent truncation.
- **Link-based access** — share the URL to collaborate; anyone with the link can view/edit.
- **Delete confirmation** — explicit confirmation required before deletion.
- **No PII collection** — no analytics, no tracking, no third-party scripts.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (strict mode) |
| Build | Vite |
| Testing | Vitest + React Testing Library |
| Styling | CSS Modules |
| Backend | Minimal serverless functions, framework-agnostic |
| Storage | Pluggable `NoteStore` interface (in-memory default, Cloudflare KV production) |
| State | React hooks + Context |
| CI/CD | GitHub Actions |

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js 18+** (20 LTS recommended)
- **npm 9+**

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/scratchpad24.git
cd scratchpad24

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app runs at `http://localhost:5173` by default. The in-memory store is used automatically — no external services required.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm test` | Run all tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint source files (ESLint) |
| `npm run typecheck` | TypeScript type-check without emit |

---

## Project Structure

```
src/
├── api/                  # Serverless API handlers (platform-agnostic)
│   ├── createNote.ts     # POST /api/notes
│   ├── getNote.ts        # GET  /api/notes/:noteId
│   ├── updateNote.ts     # PUT  /api/notes/:noteId
│   ├── deleteNote.ts     # DELETE /api/notes/:noteId
│   ├── adapter.ts        # Platform adapter (Request/Response ↔ GenericRequest/GenericResponse)
│   ├── client.ts         # Frontend API client
│   ├── cron.ts           # Cron trigger for expired note cleanup
│   ├── rateLimiter.ts    # Per-IP, per-endpoint rate limiting
│   ├── security.ts       # HTTP security headers & CORS
│   └── types.ts          # Generic handler types
├── core/                 # Pure business logic (no platform dependencies)
│   ├── noteService.ts    # CRUD operations, validation, token comparison
│   ├── idGenerator.ts    # CSPRNG-based UUID v4 generation
│   └── expiry.ts         # 24h expiry calculation & validation
├── storage/              # Pluggable storage layer
│   ├── NoteStore.ts      # Interface definition
│   ├── InMemoryNoteStore.ts  # Development/testing store
│   └── KvNoteStore.ts    # Cloudflare KV implementation
├── components/           # UI components (each with .tsx, .test.tsx, .module.css)
│   ├── Editor/           # Text editor with live counters
│   ├── ExpiryBanner/     # Countdown banner showing remaining time
│   └── DeleteButton/     # Delete with confirmation dialog
├── hooks/                # React hooks
│   ├── useNote.ts        # Note state management
│   └── useAutosave.ts    # Debounced auto-save
├── pages/                # Route pages
│   ├── HomePage.tsx      # Landing page with "Start a new pad" button
│   ├── NotePage.tsx      # Note editor page
│   └── PrivacyPage.tsx   # Privacy & Terms (placeholder MVP language)
├── utils/
│   └── sanitize.ts       # HTML sanitization (strip < > characters)
├── App.tsx               # Root component with routing
└── main.tsx              # Entry point
tests/
├── scaffold.test.ts      # Scaffold validation tests
└── e2e/                  # End-to-end tests
```

### Key Design Principles

- **Platform-agnostic core** — `/core` and `/components` contain no vendor SDKs
- **Pluggable storage** — `NoteStore` interface allows swapping backends
- **Thin adapter layer** — `adapter.ts` bridges platform-specific Request/Response to generic handlers
- **Colocated tests** — test files sit alongside implementation files

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_CREATE` | `10` | Max note creations per IP per 60s window |
| `RATE_LIMIT_READ` | `30` | Max note reads per IP per 60s window |
| `RATE_LIMIT_UPDATE` | `60` | Max note updates per IP per 60s window |
| `RATE_LIMIT_DELETE` | `10` | Max note deletions per IP per 60s window |

### Storage Backend

The storage backend is selected by the deployment adapter:

- **Local development**: `InMemoryNoteStore` (zero configuration, data lost on restart)
- **Cloudflare**: `KvNoteStore` backed by Cloudflare KV with `NOTES_KV` namespace binding
- **Other platforms**: Implement the `NoteStore` interface for your storage solution

### KV Namespace Binding (Cloudflare)

| Binding | Description |
|---------|-------------|
| `NOTES_KV` | Cloudflare KV namespace for note storage |

---

## Deployment

ScratchPad24 supports deployment to multiple platforms. All four options below receive equal treatment — choose the one that fits your infrastructure.

### 5.1 Cloudflare Pages + Workers + KV (Primary)

This is the **default and recommended deployment target** (Decision 8).

#### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)
- Authenticate: `wrangler login`

#### Step 1: Create KV Namespace

```bash
wrangler kv namespace create NOTES_KV
```

This outputs a namespace ID. Copy it for the next step.

#### Step 2: Configure `wrangler.toml`

```toml
name = "scratchpad24"
compatibility_date = "2024-01-01"

[vars]
RATE_LIMIT_CREATE = "10"
RATE_LIMIT_READ = "30"
RATE_LIMIT_UPDATE = "60"
RATE_LIMIT_DELETE = "10"

[[kv_namespaces]]
binding = "NOTES_KV"
id = "<YOUR_KV_NAMESPACE_ID>"

[triggers]
# Cron trigger for expired note cleanup (Decision 9)
crons = ["0 * * * *"]
```

#### Step 3: Deploy

```bash
# Build the frontend
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist

# Deploy the Worker (if using Workers for API)
wrangler deploy
```

#### Step 4: Set Up Cron Trigger (Decision 9)

The cron trigger runs hourly to clean up any expired notes that weren't removed by KV TTL. Configure in `wrangler.toml` under `[triggers]` (shown above). The cron handler is implemented in `src/api/cron.ts`.

#### Step 5: Environment Variables

Set production environment variables in the Cloudflare dashboard:

1. Go to **Workers & Pages** → your project → **Settings** → **Variables**
2. Add each `RATE_LIMIT_*` variable if you want to override defaults

#### Verify Deployment

```bash
curl https://your-project.pages.dev/api/notes -X POST \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from Cloudflare!"}'
```

---

### 5.2 Vercel

#### Prerequisites

- [Vercel account](https://vercel.com/signup)
- [Vercel CLI](https://vercel.com/docs/cli) (`npm install -g vercel`)
- Authenticate: `vercel login`

#### Step 1: Connect Repository

```bash
# Option A: Deploy from CLI
vercel

# Option B: Connect via Vercel Dashboard
# Go to https://vercel.com/new and import your GitHub repo
```

#### Step 2: Configure Storage

Vercel does not have a built-in KV store equivalent. Options:

- **Vercel KV** (Redis-based): Provision from the Vercel dashboard Storage tab
- **External Redis**: Use Upstash, Redis Cloud, or any Redis-compatible service
- Implement a `NoteStore` adapter for your chosen backend

Create a `vercel.json` for API route configuration:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ]
}
```

#### Step 3: Configure Environment Variables

```bash
vercel env add RATE_LIMIT_CREATE production
vercel env add RATE_LIMIT_READ production
vercel env add RATE_LIMIT_UPDATE production
vercel env add RATE_LIMIT_DELETE production

# If using external Redis
vercel env add REDIS_URL production
```

Or set them in the Vercel Dashboard: **Project Settings** → **Environment Variables**.

#### Step 4: Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

#### Verify Deployment

```bash
curl https://your-project.vercel.app/api/notes -X POST \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from Vercel!"}'
```

#### Troubleshooting

- **Serverless function timeout**: Vercel hobby plan has 10s timeout. Ensure KV operations complete within this limit.
- **Cold starts**: First request after inactivity may be slow. Consider using Vercel's provisioned concurrency (Pro plan).

---

### 5.3 Netlify

#### Prerequisites

- [Netlify account](https://app.netlify.com/signup)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (`npm install -g netlify-cli`)
- Authenticate: `netlify login`

#### Step 1: Connect Repository

```bash
# Option A: Deploy from CLI
netlify init

# Option B: Connect via Netlify Dashboard
# Go to https://app.netlify.com and add site from Git
```

#### Step 2: Configure Storage

Netlify offers **Netlify Blobs** for key-value storage. Alternatively, use an external Redis instance.

Create a `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

#### Step 3: Configure Environment Variables

```bash
# Via CLI
netlify env:set RATE_LIMIT_CREATE "10"
netlify env:set RATE_LIMIT_READ "30"
netlify env:set RATE_LIMIT_UPDATE "60"
netlify env:set RATE_LIMIT_DELETE "10"
```

Or set them in the Netlify Dashboard: **Site settings** → **Environment variables**.

#### Step 4: Deploy

```bash
# Manual deploy from CLI
netlify deploy --build --prod

# Or push to connected Git repo for automatic deploys
git push origin main
```

#### Verify Deployment

```bash
curl https://your-site.netlify.app/api/notes -X POST \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from Netlify!"}'
```

#### Troubleshooting

- **Function size limit**: Netlify has a 50 MB limit per function. The app is well under this.
- **Build timeout**: Free tier has a 15-minute build limit. Builds typically complete in under 2 minutes.

---

### 5.4 Docker / Node.js

Self-hosted option for full control over infrastructure.

#### Prerequisites

- **Docker** (for containerized deployment) or **Node.js 18+** (for bare metal)
- **Redis** (recommended for production persistence) or in-memory store (development only)

#### Option A: Docker

##### Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

ENV NODE_ENV=production
ENV RATE_LIMIT_CREATE=10
ENV RATE_LIMIT_READ=30
ENV RATE_LIMIT_UPDATE=60
ENV RATE_LIMIT_DELETE=10

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

##### Build and Run

```bash
# Build the image
docker build -t scratchpad24 .

# Run with in-memory store (development)
docker run -d -p 3000:3000 --name scratchpad24 scratchpad24

# Run with Redis backend (production)
docker run -d -p 3000:3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e RATE_LIMIT_CREATE=20 \
  --name scratchpad24 scratchpad24
```

##### Docker Compose

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - RATE_LIMIT_CREATE=10
      - RATE_LIMIT_READ=30
      - RATE_LIMIT_UPDATE=60
      - RATE_LIMIT_DELETE=10
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis-data:
```

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

#### Option B: Bare Node.js

```bash
# Build
npm ci
npm run build

# Set environment variables
export REDIS_URL=redis://localhost:6379
export RATE_LIMIT_CREATE=10

# Run
node dist/server.js
```

#### Verify Deployment

```bash
curl http://localhost:3000/api/notes -X POST \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from Docker!"}'
```

#### Troubleshooting

- **In-memory store loses data on restart**: Use Redis for production deployments.
- **Port conflicts**: Change the `EXPOSE` and `-p` mapping in Docker.
- **Memory limits**: The 100 KB per-note cap prevents runaway memory usage, but monitor Redis memory in production.

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npx vitest run src/core/noteService.test.ts

# Watch mode during development
npx vitest
```

### Coverage Requirements

**100% coverage is enforced** across all metrics (Decision 14):

| Metric | Threshold |
|--------|-----------|
| Lines | 100% |
| Branches | 100% |
| Functions | 100% |
| Statements | 100% |

The coverage threshold is configured in `vite.config.ts`. If any metric drops below 100%, the test run fails.

### Test Structure

- **Unit tests**: Colocated with source files (`*.test.ts`, `*.test.tsx`)
- **Scaffold tests**: `tests/scaffold.test.ts` validates project configuration
- **E2E tests**: `tests/e2e/` for integration testing

---

## CI/CD

Continuous integration runs on every push and pull request via GitHub Actions (Decision 13).

### Workflow (`.github/workflows/ci.yml`)

| Step | Description |
|------|-------------|
| Checkout | Clone the repository |
| Setup Node.js | Install Node.js 20 LTS |
| Install | `npm ci` for deterministic installs |
| Lint | `npm run lint` — ESLint |
| Type check | `npm run typecheck` — TypeScript strict mode |
| Test | `npm run test:coverage` — Vitest with coverage |
| Upload | Coverage report uploaded as artifact |

### Coverage Gate

The CI pipeline **fails if coverage drops below 100%** on any metric. This is enforced by Vitest's coverage thresholds in `vite.config.ts`. There are no exceptions — all code paths must be tested.

---

## Security

### Security Features

- **No PII collection** — no accounts, no emails, no tracking
- **CSPRNG IDs** — note IDs and delete tokens use `crypto.getRandomValues()` (128+ bits entropy)
- **Constant-time token comparison** — delete tokens compared with `crypto.timingSafeEqual` to prevent timing attacks
- **Uniform 404 responses** — expired, missing, and unauthorized requests all return identical 404 (no information leakage)
- **HTML sanitization** — all `<` and `>` characters stripped from content
- **100 KB payload cap** — hard limit with inline error, checked before body parsing
- **Per-IP rate limiting** — configurable per-endpoint limits (default: 10 create, 30 read, 60 update, 10 delete per minute)

### Security Headers

All responses include:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |

### CORS

Same-origin only. No `Access-Control-Allow-Origin` wildcard is set.

### Threat Model Considerations

- **Link sharing risk**: Anyone with the URL can view/edit/delete. Documented in UI.
- **No content moderation**: Ephemeral anonymous notes by design (Decision 12).
- **Rate limiting**: Prevents abuse but does not eliminate it.
- **No encryption at rest**: Notes stored in plaintext in KV. Acceptable for ephemeral, non-sensitive content.

---

## Key Decisions

| # | Decision |
|---|----------|
| 1 | Plain text only for v1 |
| 2 | Live char/word counter |
| 3 | 100 KB hard cap with inline error, no silent truncation |
| 4 | Last-write-wins for concurrent edits |
| 5 | Modern evergreen browsers only |
| 6 | No expiry extension |
| 7 | Delete confirmation required |
| 8 | Default deploy: Cloudflare Pages + Workers + KV |
| 9 | Cron trigger for cleanup |
| 10 | Rate limits configurable via env var |
| 11 | Privacy/Terms page uses placeholder MVP language |
| 12 | No content moderation |
| 13 | GitHub Actions CI/CD |
| 14 | 100% test coverage enforced |
| 15 | Equal deployment documentation for all four platforms |

---

## Known Limitations

- **Concurrent edits**: Last-write-wins — no conflict resolution or merge (Decision 4). If two users edit simultaneously, the last save overwrites previous changes.
- **No content moderation**: Notes are anonymous and ephemeral by design (Decision 12). There is no mechanism to flag or remove abusive content before expiry.
- **Link sharing risk**: The URL is the only credential. Anyone with the link can view, edit, or delete the note. This is documented in the UI and Privacy page.
- **No encryption at rest**: Notes are stored in plaintext. Do not use for sensitive information.
- **No expiry extension**: Once created, a note will expire exactly 24 hours later. This cannot be changed (Decision 6).
- **Privacy/Terms placeholder**: The Privacy & Terms page contains placeholder language for an MVP and is not a substitute for actual legal review (Decision 11).

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>ScratchPad24</strong> — Write now, gone tomorrow.
</p>
