# Commercial packaging

How to sell and deliver ListingPilot AI. Adapt prices and terms to your market; the [LICENSE](LICENSE) is a template that needs legal review.

## Editions

| Edition | For | Includes | Suggested model |
| --- | --- | --- | --- |
| Single Business | One merchant | Self-hosted app, all marketplace adapters, 12 months of updates | One-off fee per site |
| Agency | Catalogue agencies serving clients | Single Business + use for client work, multiple deployments | One-off or annual fee |
| SaaS / White-label | Platforms reselling the tool | Hosting for third parties, rebranding rights | Annual fee or revenue share |

## What the customer receives

- Source repository at a tagged release
- `README.md`, `docs/SETUP.md` (setup and deployment), `docs/PROVIDERS.md`, `docs/USAGE.md`, `docs/TROUBLESHOOTING.md`
- `examples/` input template and sample outputs
- `LICENSE` with their edition filled in

## Positioning and claims

- Bring-your-own-key: the customer pays their AI provider directly at the provider's rates. Do not describe AI generation as free. Only the demo template mode costs nothing, because it calls no AI model.
- Accuracy: the prompts forbid invented claims and the app flags likely problems, but the customer must still review listings. Avoid promising "100% accurate" or "compliant" content.
- Marketplaces: say "export formats for Amazon, Shopify, ..." and not "official" or "certified" integrations. The footer disclaimer on the landing page covers trademarks.

## Release checklist

1. `npm ci && npm run lint && npm run typecheck && npm test && npm run build`
2. Try the demo from the landing page in a clean browser.
3. Generate a few sample products with a real key for each provider you support.
4. Update `PROMPT_VERSION` if prompts changed, and the model price table in `src/lib/ai/providers/anthropic.ts` if prices changed.
5. Tag the release and write release notes.

## Rebranding (White-label)

- Product name and copy: `src/app/page.tsx`, `src/app/layout.tsx` (metadata), `src/components/workspace/workspace-app.tsx` (header).
- Colors: Tailwind `indigo-*` classes in `src/components/ui/index.tsx` and pages.
- Export file names: `exportRecords` in `src/lib/export/registry.ts`.
