import { ProviderError, fromHttpStatus } from "../errors";
import type { AIProvider, StructuredRequest, StructuredResult } from "../types";

/**
 * Adapter for any API that implements the OpenAI Chat Completions format with
 * JSON-schema structured outputs (OpenAI, and many gateways and self-hosted servers).
 * Uses fetch directly so no vendor SDK is bundled.
 */
export interface OpenAICompatibleOptions {
  baseURL?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string; type?: string };
}

export function createOpenAICompatibleProvider(opts: OpenAICompatibleOptions = {}): AIProvider {
  const baseURL = (opts.baseURL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  return {
    id: "openai",
    label: "OpenAI-compatible",
    billable: true,
    defaultModel: opts.defaultModel ?? "",
    models: [],
    allowCustomModel: true,
    async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
      if (!req.model) throw new ProviderError("bad_request", "Enter a model ID for the OpenAI-compatible provider in Settings.");

      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await fetchImpl(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${req.apiKey}` },
          body: JSON.stringify({
            model: req.model,
            max_completion_tokens: req.maxOutputTokens,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: req.schemaName, strict: true, schema: req.jsonSchema },
            },
          }),
          signal,
        });
      } catch (err) {
        if (req.signal?.aborted) throw new ProviderError("cancelled", "Request was cancelled.", { cause: err });
        if (timeout.aborted) throw new ProviderError("timeout", "The provider took too long to respond.", { cause: err });
        throw new ProviderError("network", "Could not connect to the provider.", { cause: err });
      }

      const text = await res.text();
      if (!res.ok) {
        let message = `Provider returned HTTP ${res.status}.`;
        try {
          const body = JSON.parse(text) as ChatCompletionResponse;
          if (body.error?.message) message = body.error.message;
        } catch {
          /* non-JSON error body */
        }
        throw fromHttpStatus(res.status, message, res.headers.get("retry-after"), text);
      }

      let body: ChatCompletionResponse;
      try {
        body = JSON.parse(text);
      } catch {
        throw new ProviderError("invalid_output", "The provider returned a response that is not JSON.");
      }
      const choice = body.choices?.[0];
      if (choice?.message?.refusal) throw new ProviderError("refused", "The model declined to write this listing.");
      if (choice?.finish_reason === "length") throw new ProviderError("output_truncated", "The model's output was cut off at the token limit.");
      if (choice?.finish_reason === "content_filter") throw new ProviderError("refused", "The provider's content filter blocked the output.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(choice?.message?.content ?? "");
      } catch {
        throw new ProviderError("invalid_output", "The model's output was not valid JSON.");
      }
      const checked = req.schema.safeParse(parsed);
      if (!checked.success) throw new ProviderError("invalid_output", "The model's output did not match the listing format.");

      return {
        output: checked.data,
        usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 },
        model: body.model ?? req.model,
      };
    },
  };
}
