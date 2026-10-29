# ListingPilot AI

Turn raw product spreadsheets into consistent, accurate, SEO-friendly marketplace listings in bulk.

Sellers import a CSV, map its columns, fix what the validator finds, choose a marketplace, language and tone, and generate titles, short and long descriptions, feature bullets, FAQs and SEO metadata. Every listing is checked for invented claims and changed specifications, reviewed side by side with the source data, edited if needed, approved, and exported as a CSV laid out for Amazon, Shopify, Etsy, eBay, WooCommerce or a generic all-fields format.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional for local use
npm run dev
```

Open http://localhost:3000 and click **Try the demo with sample products**. The demo provider is a free template generator that makes no AI calls, so you can try the whole workflow without an API key. To generate real copy, open **Settings** in the app and add an Anthropic or OpenAI-compatible key.

## What's included

| Deliverable | Where |
| --- | --- |
| Working app (import → map → validate → select → configure → generate → review → export) | `src/app/app`, `src/components/workspace` |
| Landing page that demonstrates the workflow | `src/app/page.tsx` |
| AI provider adapters (Anthropic, OpenAI-compatible, demo) | `src/lib/ai` |
| Prompt templates and output schema | `src/lib/prompts`, [docs/PROMPTS.md](docs/PROMPTS.md) |
| Quality controls (claims, numbers, prohibited phrases, required keywords, limits) | `src/lib/quality` |
| Marketplace export adapters | `src/lib/export` |
| Example input and output CSVs | [`examples/`](examples) |
| Automated tests (111) | `tests/`, run `npm test` |
| Setup and deployment guide | [docs/SETUP.md](docs/SETUP.md) |
| Provider configuration guide | [docs/PROVIDERS.md](docs/PROVIDERS.md) |
| Usage guide | [docs/USAGE.md](docs/USAGE.md) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Commercial packaging and license | [COMMERCIAL.md](COMMERCIAL.md), [LICENSE](LICENSE) |

## Stack

Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript 5, Tailwind CSS 4, React Hook Form 7.91 with Zod 4 resolvers, Papa Parse 5.7, Neon serverless driver 1.2, the official Anthropic TypeScript SDK 1.3, and Vitest 5. Versions were checked against the npm registry on 2026-10-29.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit and integration tests |
| `npm run typecheck` | Generate route types and type-check |
| `npm run lint` | ESLint |

## Cost and billing

Generation runs on the customer's own AI provider account (or the operator's, if a server key is configured). Providers charge for every request, including retries. The app shows a token and cost estimate before a job, asks for confirmation for large or unpriced jobs, and never describes AI generation as free. Only the demo template provider is free, because it does not call a model.

## Security notes

- Provider keys never reach browser JavaScript. A customer's key is posted once to `/api/keys`, encrypted with AES-256-GCM using `APP_SECRET`, and stored in an `HttpOnly; SameSite=Strict` cookie scoped to `/api`.
- All AI calls happen in server route handlers. Requests are validated with Zod, size-limited, rate-limited per client, and checked for same-origin.
- Saved workspaces go to Neon Postgres when `DATABASE_URL` is set (see [docs/SETUP.md](docs/SETUP.md#database-neon-postgres)), otherwise to the customer's browser.
- Model output is treated as untrusted text: it is HTML-escaped when building HTML exports, and CSV cells are protected against spreadsheet formula injection.
