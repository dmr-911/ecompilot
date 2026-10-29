# Setup and deployment

## Requirements

- Node.js 20.9 or newer (tested on Node 22)
- npm 10

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

`APP_SECRET` is optional in development. Without it, a random secret is created per server process, so customer keys saved in Settings are forgotten when the server restarts.

## Configuration

All settings are environment variables. See [`.env.example`](../.env.example) for the full list with comments. The important ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_SECRET` | none | **Required in production.** 32+ characters. Encrypts stored customer keys. Rotating it signs every customer out of their saved key. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | none | Optional server-wide keys. If set, customers without their own key run on your account. |
| `ALLOW_USER_KEYS` | `true` | Let customers save their own key. |
| `ENABLE_DEMO_PROVIDER` | `true` | Offer the free template provider. |
| `MAX_UPLOAD_BYTES` | 5 MB | CSV upload limit. |
| `MAX_BATCH_SIZE` | 10 | Products per `/api/generate` request. The browser splits larger jobs. |
| `MAX_PRODUCTS_PER_JOB` | 500 | Largest job a customer can start. |
| `GENERATION_CONCURRENCY` | 3 | Parallel provider calls per request. |
| `RATE_LIMIT_PER_MINUTE` | 20 | Generate requests per client IP per minute. |
| `STORAGE_DRIVER` | `none` | `none` (browser storage), `file` (JSON on disk), or `memory`. |

## Production build

```bash
npm ci
npm run build
APP_SECRET=$(openssl rand -hex 32) npm start
```

The server listens on port 3000 (`PORT` to change).

## Deploying

### Any Node host (VM, container)

1. Set environment variables, at minimum `APP_SECRET`.
2. `npm ci && npm run build && npm start`.
3. Put it behind HTTPS. Cookies are marked `Secure` in production, so plain HTTP will not keep customer keys.
4. If you are behind a proxy, make sure it forwards `X-Forwarded-For` (used for rate limiting) and `Host`/`X-Forwarded-Host` (used for the same-origin check).

A minimal Dockerfile:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]
```

For `STORAGE_DRIVER=file`, mount a volume at `STORAGE_DIR`.

### Vercel and other serverless hosts

The app works on serverless platforms with two caveats:

- The rate limiter and `memory` storage are per instance. For real limits across instances, implement `RateLimiter` (`src/lib/server/rate-limit.ts`) on a shared store such as Redis, and pass it in `src/lib/server/deps.ts`.
- `file` storage needs a persistent disk. On serverless, keep the default browser storage or implement `ServerWorkspaceStore` (`src/lib/storage/server-store.ts`) on a database.

`/api/generate` declares `maxDuration = 300` seconds. On plans with a lower limit, lower `MAX_BATCH_SIZE` so a batch finishes in time.

## Adding a database

The UI talks to `WorkspaceRepository` and the server to `ServerWorkspaceStore`. To use Postgres, SQLite or similar:

1. Implement `ServerWorkspaceStore` (four methods: `list`, `get`, `put`, `delete`, all scoped by owner).
2. Construct it in `src/lib/server/deps.ts` for a new `STORAGE_DRIVER` value.
3. When you add authentication, pass the signed-in user id as the owner instead of the anonymous cookie in `src/lib/server/workspace-handlers.ts`.

Nothing else changes.

## Verifying a deployment

```bash
curl -s https://your-host/api/providers | head
```

You should see the enabled providers and limits, and no keys.
