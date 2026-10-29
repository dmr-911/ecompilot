# Architecture

```
Browser (client components)                    Server (route handlers)
───────────────────────────                    ───────────────────────
Import ── POST /api/import ──────────────────▶ csv/parse  (size + row limits)
Map / validate (csv/mapping, csv/validate)
Products table + editor (RHF + Zod)
Generate ── POST /api/estimate ──────────────▶ prompts + ai/pricing
         ── POST /api/generate (≤ batch) ────▶ rate limit → key vault → generation/service
                                                   └─ ai/<provider> adapter ─▶ AI API
Review (quality flags, edits) ◀── results ─── quality/checks
Export (export/registry adapters, csv/serialize)
Save ── WorkspaceRepository ─▶ localStorage, or /api/workspaces ▶ ServerWorkspaceStore
```

## Modules

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `lib/products` | Standard field list, Zod schemas, spec parsing | nothing |
| `lib/csv` | Parse, map, validate, de-duplicate, serialise | products |
| `lib/prompts` | System/user prompt templates, output schema | products, generation/options, export (constraints) |
| `lib/ai` | `AIProvider` interface, provider adapters, error model, pricing | prompts (schema types only) |
| `lib/quality` | Deterministic checks on generated output | products, prompts, export |
| `lib/generation` | Options schema, batching, per-item retry and fatal-error handling | ai, prompts, quality |
| `lib/export` | Marketplace profiles: constraints, prompt guidance, CSV layout | csv |
| `lib/storage` | Workspace persistence interfaces and implementations | products |
| `lib/server` | Config, key vault, rate limiting, HTTP helpers, route handler logic | everything above |
| `lib/workspace` | Pure reducer for UI state | csv, quality |
| `components/workspace` | Step UIs, context, generation runner | lib |

Rules that keep it modular:

- Only `lib/ai/providers/*` know about a vendor. The rest of the app sees `AIProvider` and `ProviderError`.
- Route files in `src/app/api` are one-line wrappers. Logic lives in `lib/server/handlers.ts` and takes its dependencies as an argument, so it is tested without Next.js.
- Marketplace knowledge lives in one adapter file per marketplace: limits used by prompts and quality checks, writing guidance used by prompts, and the export layout.
- The UI never calls a provider. API keys exist only on the server.

## Request lifecycle for generation

1. The browser splits the selected products into batches of `MAX_BATCH_SIZE`.
2. For each batch it sends `POST /api/generate` with options and product fields.
3. The handler checks origin, body size and shape (Zod), batch size, provider, model, key availability, then the per-client rate limit.
4. `generateBatch` runs up to `GENERATION_CONCURRENCY` products in parallel. Each product gets the same system prompt (cache-friendly) and its own user prompt.
5. Each adapter validates the model output against the Zod schema. Transient failures are retried once (short `Retry-After` honoured). Fatal failures (bad key, no quota, unknown model) stop the batch and mark the rest with the same error.
6. Successful outputs are run through `runQualityChecks`. The response contains one result per product: listing, flags and usage, or an error with a customer-facing message and a retryable flag.
7. The browser applies results as each batch returns, so progress is saved even if the job is cancelled. A server 429 makes the browser wait and retry the batch.

## Limits

| Limit | Where enforced |
| --- | --- |
| Upload size | Browser (pre-check) and `/api/import` (content-length and file size) |
| Rows, columns, cell length | `csv/parse` |
| Field lengths and formats | `products/schema` (Zod), both client and server |
| Products per request | `/api/generate` |
| Products per job | Generate step and `/api/estimate` |
| Requests per minute | `RateLimiter` in `/api/generate` and `/api/import` |
| JSON body size | `readJson` in every handler |
| Output tokens | `MAX_OUTPUT_TOKENS` passed to providers |
