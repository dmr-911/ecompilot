import type { z } from "zod";

export type ProviderId = "anthropic" | "openai" | "demo";

export interface ModelInfo {
  id: string;
  label: string;
  /** USD per 1M tokens. Omitted when the price is unknown; estimates are then unavailable. */
  inputPerMTok?: number;
  outputPerMTok?: number;
  note?: string;
}

export interface StructuredRequest<T> {
  model: string;
  apiKey: string;
  system: string;
  prompt: string;
  /** Zod schema the output must satisfy. */
  schema: z.ZodType<T>;
  /** Equivalent JSON Schema for providers that take one. */
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface StructuredResult<T> {
  output: T;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

/**
 * The only surface the rest of the app sees. Adapters must:
 * - never log or return the API key,
 * - throw ProviderError (never raw SDK errors),
 * - validate output against `schema` before returning.
 */
export interface AIProvider {
  id: ProviderId;
  label: string;
  /** True when the provider charges per token (shown in the UI next to estimates). */
  billable: boolean;
  defaultModel: string;
  models: ModelInfo[];
  /** Whether a customer-supplied model ID outside `models` is accepted. */
  allowCustomModel: boolean;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
}
