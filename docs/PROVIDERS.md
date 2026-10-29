# AI provider configuration

ListingPilot calls AI providers only from the server. Three providers ship with the app.

| Provider | ID | Billing | Notes |
| --- | --- | --- | --- |
| Anthropic (Claude) | `anthropic` | Per token, to the key's account | Official Anthropic TypeScript SDK, structured JSON output |
| OpenAI-compatible | `openai` | Per token, to the key's account | Any Chat Completions API with `response_format: json_schema` |
| Demo template | `demo` | Free | No AI. Rearranges the supplied facts. For trying the workflow. |

## Where keys come from

For each request the server uses, in order:

1. The customer's own key, if `ALLOW_USER_KEYS=true` and they saved one in Settings.
2. The server key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`).
3. Otherwise the request is refused with "Add your API key in Settings".

Customer keys are encrypted with `APP_SECRET` and kept in an httpOnly cookie. The browser can't read them, and no API response returns them; Settings shows only the first and last four characters.

## Anthropic

1. Create an API key in the Claude Console at https://platform.claude.com.
2. Paste it in Settings → Anthropic, or set `ANTHROPIC_API_KEY` on the server.
3. Choose a model on the Generate step:

| Model ID | Use | List price (USD / 1M tokens, input / output) |
| --- | --- | --- |
| `claude-opus-5-5` (default) | Highest quality | $4 / $20 |
| `claude-sonnet-5-5` | Balanced quality and cost | $2 / $10 |
| `claude-haiku-5-5` | Fastest and cheapest for simple catalogues | $0.10 / $0.50 |

Prices are Anthropic's first-party list prices as of October 2026 and are used only for estimates. Check https://claude.com/pricing for current prices, and override them with `MODEL_PRICING_JSON` if they change.

Request details: the adapter uses structured outputs (`output_config.format`) with the listing JSON schema, `effort: "medium"`, and Anthropic's server-side fallback (`fallbacks: "default"`), which re-runs a request on a fallback model if the chosen model declines for policy reasons. Reasoning tokens are billed as output tokens, which is why estimates show an output range. The SDK retries rate limits and server errors twice before the app's own retry.

`ANTHROPIC_BASE_URL` points the adapter at a gateway or proxy if you use one.

## OpenAI-compatible

Works with OpenAI and with gateways or self-hosted servers that implement `POST /chat/completions` with strict JSON-schema structured outputs.

1. Set `OPENAI_BASE_URL` if you are not using `https://api.openai.com/v1`.
2. Optionally set `OPENAI_DEFAULT_MODEL` so the model field is pre-filled.
3. Paste a key in Settings → OpenAI-compatible, or set `OPENAI_API_KEY`.
4. Enter the model ID on the Generate step.

No prices are built in for this provider, because model names and prices vary by vendor. Without a price, the estimate shows tokens only, and the customer has to confirm before starting. Add prices with:

```bash
MODEL_PRICING_JSON='{"openai:your-model-id":{"inputPerMTok":1.25,"outputPerMTok":10}}'
```

## Errors customers can see

| Kind | Cause | Retryable |
| --- | --- | --- |
| `invalid_api_key` | Key rejected (401) | No. The job stops early so the same error isn't repeated hundreds of times. |
| `permission_denied` | Key can't use the model (403) | No |
| `model_not_found` | Unknown model ID (404) | No |
| `quota_exceeded` | No credit or quota left | No |
| `rate_limited` | Provider 429 | Yes, after waiting |
| `provider_unavailable` | 5xx or overloaded | Yes |
| `timeout`, `network` | Slow or unreachable | Yes |
| `invalid_output`, `output_truncated` | Output did not match the schema or was cut off | Yes |
| `refused` | The model declined | Edit the data, then retry |

## Adding a provider

1. Implement `AIProvider` from `src/lib/ai/types.ts`. `generateStructured` receives the system prompt, user prompt, Zod schema and JSON schema; it must validate the output against the schema and throw `ProviderError` for every failure.
2. Register it in `src/lib/ai/registry.ts` and add its id to `ProviderId`.
3. Add its key lookup to `resolveApiKey` in `src/lib/server/key-vault.ts`.
4. Add tests next to `tests/providers.test.ts`.
