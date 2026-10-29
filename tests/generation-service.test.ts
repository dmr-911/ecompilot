import { describe, expect, it, vi } from "vitest";
import { generateBatch, generateOne, type RunOptions } from "@/lib/generation/service";
import { ProviderError } from "@/lib/ai/errors";
import type { AIProvider } from "@/lib/ai/types";
import { chunk } from "@/lib/generation/batching";
import { listing, options, WATER_BOTTLE } from "./helpers";

function fakeProvider(impl: (prompt: string) => Promise<unknown>): AIProvider & { calls: number; maxInFlight: number } {
  let inFlight = 0;
  const p = {
    id: "openai" as const,
    label: "Fake",
    billable: true,
    defaultModel: "m",
    models: [],
    allowCustomModel: true,
    calls: 0,
    maxInFlight: 0,
    async generateStructured(req: { prompt: string }) {
      p.calls++;
      inFlight++;
      p.maxInFlight = Math.max(p.maxInFlight, inFlight);
      try {
        const output = await impl(req.prompt);
        return { output, usage: { inputTokens: 1, outputTokens: 2 }, model: "m" };
      } finally {
        inFlight--;
      }
    },
  };
  return p as unknown as AIProvider & { calls: number; maxInFlight: number };
}

const run = (provider: AIProvider, over: Partial<RunOptions> = {}): RunOptions => ({
  provider,
  model: "m",
  apiKey: "k",
  options: options(),
  concurrency: 2,
  maxOutputTokens: 1000,
  sleep: async () => {},
  ...over,
});

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, fields: { ...WATER_BOTTLE, name: `Bottle ${i}` } }));

describe("generation service", () => {
  it("returns results in input order with quality flags and usage", async () => {
    const provider = fakeProvider(async () => listing());
    const results = await generateBatch(items(3), run(provider));
    expect(results.map((r) => r.id)).toEqual(["p0", "p1", "p2"]);
    expect(results.every((r) => r.ok)).toBe(true);
    const first = results[0];
    expect(first.ok && first.usage).toEqual({ inputTokens: 1, outputTokens: 2, model: "m" });
    expect(first.ok && Array.isArray(first.flags)).toBe(true);
  });

  it("keeps going when some products fail (partial batch failure)", async () => {
    const provider = fakeProvider(async (prompt) => {
      if (prompt.includes("Bottle 1")) throw new ProviderError("invalid_output", "bad json");
      return listing();
    });
    const results = await generateBatch(items(4), run(provider, { itemRetries: 0 }));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    const failed = results.find((r) => !r.ok)!;
    expect(failed.id).toBe("p1");
    expect(!failed.ok && failed.error).toMatchObject({ kind: "invalid_output", retryable: true });
    expect(!failed.ok && failed.error.message).toMatch(/Retry this product/);
  });

  it("stops early on an invalid API key and marks the rest with the same error", async () => {
    const provider = fakeProvider(async () => {
      throw new ProviderError("invalid_api_key", "401");
    });
    const results = await generateBatch(items(6), run(provider, { concurrency: 1 }));
    expect(provider.calls).toBe(1);
    expect(results.every((r) => !r.ok && r.error.kind === "invalid_api_key" && !r.error.retryable)).toBe(true);
  });

  it("retries transient errors, honouring short Retry-After values", async () => {
    let n = 0;
    const sleep = vi.fn(async () => {});
    const provider = fakeProvider(async () => {
      if (n++ === 0) throw new ProviderError("rate_limited", "429", { retryAfterMs: 1500 });
      return listing();
    });
    const r = await generateOne(items(1)[0], run(provider, { sleep, itemRetries: 1 }));
    expect(r.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(1500);
  });

  it("does not wait inline for long Retry-After values", async () => {
    const provider = fakeProvider(async () => {
      throw new ProviderError("rate_limited", "429", { retryAfterMs: 60_000 });
    });
    const r = await generateOne(items(1)[0], run(provider));
    expect(provider.calls).toBe(1);
    expect(!r.ok && r.error).toMatchObject({ kind: "rate_limited", retryAfterMs: 60_000 });
  });

  it("wraps unexpected exceptions without leaking them", async () => {
    const provider = fakeProvider(async () => {
      throw new Error("secret internal detail sk-abc");
    });
    const r = await generateOne(items(1)[0], run(provider, { itemRetries: 0 }));
    expect(!r.ok && r.error.kind).toBe("provider_unavailable");
    expect(!r.ok && r.error.message).not.toContain("sk-abc");
  });

  it("respects the concurrency limit", async () => {
    const provider = fakeProvider(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return listing();
    });
    await generateBatch(items(8), run(provider, { concurrency: 3 }));
    expect(provider.maxInFlight).toBe(3);
  });

  it("splits jobs into batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(() => chunk([1], 0)).toThrow();
  });
});
