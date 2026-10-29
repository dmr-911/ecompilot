import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ProviderError, parseRetryAfter } from "../errors";
import type { AIProvider, StructuredRequest, StructuredResult } from "../types";

/** Prices: Anthropic first-party API list prices, USD per 1M tokens (checked 2026-10). */
export const ANTHROPIC_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (highest quality)", inputPerMTok: 4, outputPerMTok: 20 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (balanced)", inputPerMTok: 2, outputPerMTok: 10 },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5 (fastest, lowest cost)",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    note: "Price applies to prompts up to 100K tokens; listing prompts are far smaller.",
  },
];

const TIMEOUT_MS = 120_000;

function translateError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  // Most specific first. APIConnectionError and APIUserAbortError extend APIError in the TS SDK.
  if (err instanceof Anthropic.APIUserAbortError) return new ProviderError("cancelled", "Request was cancelled.", { cause: err });
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError("timeout", "Anthropic API request timed out.", { cause: err });
  if (err instanceof Anthropic.APIConnectionError) return new ProviderError("network", "Could not connect to the Anthropic API.", { cause: err });
  if (err instanceof Anthropic.AuthenticationError) return new ProviderError("invalid_api_key", "Anthropic rejected the API key.", { status: 401, cause: err });
  if (err instanceof Anthropic.PermissionDeniedError) return new ProviderError("permission_denied", "This API key cannot use the selected model.", { status: 403, cause: err });
  if (err instanceof Anthropic.NotFoundError) return new ProviderError("model_not_found", "Anthropic does not recognise the selected model.", { status: 404, cause: err });
  if (err instanceof Anthropic.RateLimitError) {
    return new ProviderError("rate_limited", "Anthropic rate limit reached.", {
      status: 429,
      retryAfterMs: parseRetryAfter(err.headers?.get("retry-after")),
      cause: err,
    });
  }
  if (err instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(err.message)) return new ProviderError("quota_exceeded", "Your Anthropic credit balance is too low.", { status: 400, cause: err });
    return new ProviderError("bad_request", `Anthropic rejected the request: ${err.message}`, { status: 400, cause: err });
  }
  if (err instanceof Anthropic.InternalServerError) return new ProviderError("provider_unavailable", "Anthropic API is temporarily unavailable.", { status: err.status, cause: err });
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new ProviderError("provider_unavailable", "Anthropic API is overloaded.", { status: 529, cause: err });
    return new ProviderError("bad_request", `Anthropic API error: ${err.message}`, { status: err.status, cause: err });
  }
  return new ProviderError("provider_unavailable", "Unexpected error calling Anthropic.", { cause: err });
}

export interface AnthropicProviderOptions {
  /** Injected for tests. */
  createClient?: (apiKey: string) => Anthropic;
  baseURL?: string;
}

export function createAnthropicProvider(opts: AnthropicProviderOptions = {}): AIProvider {
  const createClient =
    opts.createClient ??
    ((apiKey: string) => new Anthropic({ apiKey, baseURL: opts.baseURL, maxRetries: 2, timeout: TIMEOUT_MS }));

  return {
    id: "anthropic",
    label: "Anthropic (Claude)",
    billable: true,
    defaultModel: "claude-opus-5-5",
    models: ANTHROPIC_MODELS,
    allowCustomModel: true,
    async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
      const client = createClient(req.apiKey);
      let response;
      try {
        response = await client.beta.messages.create(
          {
            model: req.model,
            max_tokens: req.maxOutputTokens,
            system: req.system,
            messages: [{ role: "user", content: req.prompt }],
            output_config: { format: betaZodOutputFormat(req.schema), effort: "medium" },
            // Server-side fallback: if the model declines for policy reasons, the API
            // retries on its default fallback model inside the same call.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { signal: req.signal },
        );
      } catch (err) {
        throw translateError(err);
      }

      if (response.stop_reason === "refusal") {
        throw new ProviderError("refused", "The model declined to write this listing.");
      }
      if (response.stop_reason === "max_tokens") {
        throw new ProviderError("output_truncated", "The model's output was cut off at the token limit.");
      }
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ProviderError("invalid_output", "The model's output was not valid JSON.");
      }
      const checked = req.schema.safeParse(parsed);
      if (!checked.success) {
        throw new ProviderError("invalid_output", "The model's output did not match the listing format.");
      }
      return {
        output: checked.data,
        usage: { inputTokens: response.usage.input_tokens ?? 0, outputTokens: response.usage.output_tokens ?? 0 },
        model: response.model,
      };
    },
  };
}
