import type { AIProvider } from "../ai/types";
import { ProviderError, ERROR_HELP, type ProviderErrorKind } from "../ai/errors";
import { generatedListingJsonSchema, generatedListingSchema, type GeneratedListing } from "../prompts/output-schema";
import { buildSystemPrompt, buildUserPrompt } from "../prompts/templates";
import { runQualityChecks, type QualityFlag } from "../quality/checks";
import type { ProductFields } from "../products/fields";
import type { GenerationOptions } from "./options";

export interface GenerationItem {
  id: string;
  fields: ProductFields;
}

export type GenerationItemResult =
  | {
      id: string;
      ok: true;
      listing: GeneratedListing;
      flags: QualityFlag[];
      usage: { inputTokens: number; outputTokens: number; model: string };
    }
  | {
      id: string;
      ok: false;
      error: { kind: ProviderErrorKind; message: string; retryable: boolean; retryAfterMs?: number };
    };

export interface RunOptions {
  provider: AIProvider;
  model: string;
  apiKey: string;
  options: GenerationOptions;
  concurrency: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
  /** Retries per item for transient errors, on top of any retries inside the provider SDK. */
  itemRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Errors that will fail every remaining item the same way, so the batch stops early. */
const FATAL: ReadonlySet<ProviderErrorKind> = new Set(["invalid_api_key", "permission_denied", "quota_exceeded", "model_not_found", "cancelled"]);
const MAX_INLINE_WAIT_MS = 10_000;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function toFailure(id: string, err: unknown): GenerationItemResult {
  const e = err instanceof ProviderError ? err : new ProviderError("provider_unavailable", "Unexpected error during generation.", { cause: err });
  return {
    id,
    ok: false,
    error: { kind: e.kind, message: `${ERROR_HELP[e.kind]} (${e.message})`, retryable: e.retryable, retryAfterMs: e.retryAfterMs },
  };
}

export async function generateOne(item: GenerationItem, run: RunOptions): Promise<GenerationItemResult> {
  const system = buildSystemPrompt(run.options);
  const prompt = buildUserPrompt(item.fields);
  const sleep = run.sleep ?? defaultSleep;
  const retries = run.itemRetries ?? 1;

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await run.provider.generateStructured<GeneratedListing>({
        model: run.model,
        apiKey: run.apiKey,
        system,
        prompt,
        schema: generatedListingSchema,
        jsonSchema: generatedListingJsonSchema as unknown as Record<string, unknown>,
        schemaName: "product_listing",
        maxOutputTokens: run.maxOutputTokens,
        signal: run.signal,
      });
      return {
        id: item.id,
        ok: true,
        listing: result.output,
        flags: runQualityChecks(item.fields, result.output, run.options),
        usage: { ...result.usage, model: result.model },
      };
    } catch (err) {
      const e = err instanceof ProviderError ? err : undefined;
      const canWait = !e?.retryAfterMs || e.retryAfterMs <= MAX_INLINE_WAIT_MS;
      if (e?.retryable && attempt < retries && canWait && !run.signal?.aborted) {
        await sleep(e.retryAfterMs ?? 1000 * 2 ** attempt);
        continue;
      }
      return toFailure(item.id, err);
    }
  }
}

/**
 * Generates listings for a batch with bounded concurrency. One product failing
 * never fails the batch; a fatal error (bad key, no quota) stops new work and
 * marks the remaining items with the same error so the customer sees one cause.
 */
export async function generateBatch(items: GenerationItem[], run: RunOptions): Promise<GenerationItemResult[]> {
  const results = new Array<GenerationItemResult | undefined>(items.length);
  let next = 0;
  let fatal: GenerationItemResult | undefined;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      if (fatal && !fatal.ok) {
        results[i] = { id: items[i].id, ok: false, error: fatal.error };
        continue;
      }
      const r = await generateOne(items[i], run);
      results[i] = r;
      if (!r.ok && FATAL.has(r.error.kind)) fatal = r;
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(run.concurrency, items.length)) }, worker);
  await Promise.all(workers);
  return results.map((r, i) => r ?? toFailure(items[i].id, new ProviderError("provider_unavailable", "Item was not processed.")));
}
