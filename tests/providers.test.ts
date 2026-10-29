import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { createAnthropicProvider } from "@/lib/ai/providers/anthropic";
import { createDemoProvider, demoListing } from "@/lib/ai/providers/demo";
import { ProviderError, fromHttpStatus } from "@/lib/ai/errors";
import { generatedListingJsonSchema, generatedListingSchema, type GeneratedListing } from "@/lib/prompts/output-schema";
import type { AIProvider, StructuredRequest } from "@/lib/ai/types";
import { listing } from "./helpers";

function req(over: Partial<StructuredRequest<GeneratedListing>> = {}): StructuredRequest<GeneratedListing> {
  return {
    model: "test-model",
    apiKey: "sk-test-1234567890",
    system: "system",
    prompt: "Product name: Mug",
    schema: generatedListingSchema,
    jsonSchema: generatedListingJsonSchema as unknown as Record<string, unknown>,
    schemaName: "product_listing",
    maxOutputTokens: 1000,
    ...over,
  };
}

async function kind(p: Promise<unknown>) {
  try {
    await p;
    return "resolved";
  } catch (e) {
    expect(e).toBeInstanceOf(ProviderError);
    return (e as ProviderError).kind;
  }
}

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("OpenAI-compatible provider", () => {
  const make = (fetchImpl: typeof fetch) => createOpenAICompatibleProvider({ baseURL: "https://api.example.test/v1/", fetchImpl });

  it("sends a JSON-schema request with the key only in the Authorization header", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse(200, { model: "test-model", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(listing()) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }),
    );
    const out = await make(fetchImpl as unknown as typeof fetch).generateStructured(req());
    expect(out.output.title).toBe(listing().title);
    expect(out.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/chat/completions");
    const body = JSON.parse(String(init!.body));
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(JSON.stringify(body)).not.toContain("sk-test");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer sk-test-1234567890");
  });

  it.each([
    [401, { error: { message: "Incorrect API key" } }, {}, "invalid_api_key"],
    [403, { error: { message: "no access" } }, {}, "permission_denied"],
    [404, { error: { message: "model not found" } }, {}, "model_not_found"],
    [429, { error: { message: "Rate limit", type: "requests" } }, { "retry-after": "3" }, "rate_limited"],
    [429, { error: { message: "You exceeded your current quota", code: "insufficient_quota" } }, {}, "quota_exceeded"],
    [500, { error: { message: "boom" } }, {}, "provider_unavailable"],
    [503, "<html>down</html>", {}, "provider_unavailable"],
    [400, { error: { message: "bad param" } }, {}, "bad_request"],
  ])("maps HTTP %i to %s", async (status, body, headers, expected) => {
    const p = make((async () => jsonResponse(status as number, body, headers as Record<string, string>)) as unknown as typeof fetch);
    expect(await kind(p.generateStructured(req()))).toBe(expected);
  });

  it("passes Retry-After through on rate limits", async () => {
    const p = make((async () => jsonResponse(429, { error: { message: "slow down" } }, { "retry-after": "7" })) as unknown as typeof fetch);
    await expect(p.generateStructured(req())).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 7000, retryable: true });
  });

  it("rejects malformed, truncated, refused and off-schema output", async () => {
    const reply = (choice: object) => make((async () => jsonResponse(200, { choices: [choice] })) as unknown as typeof fetch);
    expect(await kind(reply({ finish_reason: "stop", message: { content: "not json" } }).generateStructured(req()))).toBe("invalid_output");
    expect(await kind(reply({ finish_reason: "stop", message: { content: '{"title":1}' } }).generateStructured(req()))).toBe("invalid_output");
    expect(await kind(reply({ finish_reason: "length", message: { content: "{" } }).generateStructured(req()))).toBe("output_truncated");
    expect(await kind(reply({ finish_reason: "stop", message: { content: null, refusal: "no" } }).generateStructured(req()))).toBe("refused");
  });

  it("maps network failures and requires a model", async () => {
    const p = make((async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch);
    expect(await kind(p.generateStructured(req()))).toBe("network");
    expect(await kind(p.generateStructured(req({ model: "" })))).toBe("bad_request");
  });
});

describe("Anthropic provider", () => {
  const withFetch = (fetchImpl: (url: string, init: RequestInit) => Promise<Response>) =>
    createAnthropicProvider({ createClient: (apiKey) => new Anthropic({ apiKey, fetch: fetchImpl as unknown as typeof fetch, maxRetries: 0 }) });

  const message = (over: object = {}) => ({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text: JSON.stringify(listing()) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 120, output_tokens: 340 },
    ...over,
  });

  it("returns validated output and usage, sending structured output and fallback options", async () => {
    let sent: Record<string, unknown> = {};
    let headers: Headers = new Headers();
    const p = withFetch(async (_url, init) => {
      sent = JSON.parse(String(init.body));
      headers = new Headers(init.headers);
      return jsonResponse(200, message());
    });
    const out = await p.generateStructured(req({ model: "claude-opus-5-5" }));
    expect(out.output.bullets).toHaveLength(5);
    expect(out.usage).toEqual({ inputTokens: 120, outputTokens: 340 });
    expect(sent).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "medium", format: { type: "json_schema" } } });
    expect(sent).not.toHaveProperty("temperature");
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(`${headers.get("x-api-key") ?? ""}${headers.get("authorization") ?? ""}`).toContain("sk-test-1234567890");
  });

  it.each([
    [401, "authentication_error", "invalid_api_key"],
    [403, "permission_error", "permission_denied"],
    [404, "not_found_error", "model_not_found"],
    [429, "rate_limit_error", "rate_limited"],
    [500, "api_error", "provider_unavailable"],
    [529, "overloaded_error", "provider_unavailable"],
  ])("maps HTTP %i (%s) to %s", async (status, type, expected) => {
    const p = withFetch(async () => jsonResponse(status as number, { type: "error", error: { type, message: "x" } }));
    expect(await kind(p.generateStructured(req()))).toBe(expected);
  });

  it("detects low credit balance as quota_exceeded", async () => {
    const p = withFetch(async () => jsonResponse(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }));
    expect(await kind(p.generateStructured(req()))).toBe("quota_exceeded");
  });

  it("handles refusals and truncation", async () => {
    expect(await kind(withFetch(async () => jsonResponse(200, message({ stop_reason: "refusal", content: [] }))).generateStructured(req()))).toBe("refused");
    expect(await kind(withFetch(async () => jsonResponse(200, message({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] }))).generateStructured(req()))).toBe("output_truncated");
  });

  it("maps connection failures to network errors", async () => {
    const p = withFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await kind(p.generateStructured(req()))).toBe("network");
  });
});

describe("demo provider", () => {
  const demo: AIProvider = createDemoProvider({ delayMs: 0 });

  it("only reuses supplied facts and reports what is missing", async () => {
    const out = await demo.generateStructured(
      req({ prompt: "Product name: Mug\nBrand: Kettle\nSpecifications: Capacity: 350 ml; Material: stoneware", system: "Language: write every field in English (US)\n- title: at most 80 characters.\n- bullets: exactly 5 feature bullets" }),
    );
    expect(out.output.title).toBe("Kettle Mug");
    expect(out.output.bullets).toEqual(["Capacity: 350 ml.", "Material: stoneware."]);
    expect(out.output.missingInformation).toContain("Dimensions");
    expect(out.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("notes that demo output is English-only", () => {
    expect(demoListing("Product name: Mug", "Language: write every field in German (de-DE)").missingInformation.join(" ")).toMatch(/English only/);
  });

  it("can simulate a failure for testing partial batches", async () => {
    expect(await kind(demo.generateStructured(req({ prompt: "Product name: Mug [demo-fail]" })))).toBe("provider_unavailable");
  });
});

describe("fromHttpStatus", () => {
  it("parses HTTP-date Retry-After values", () => {
    const e = fromHttpStatus(429, "slow", new Date(Date.now() + 5000).toUTCString());
    expect(e.retryAfterMs).toBeGreaterThan(3000);
    expect(e.retryAfterMs).toBeLessThanOrEqual(5000);
  });
});
