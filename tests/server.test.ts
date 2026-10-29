import { describe, expect, it } from "vitest";
import { handleEstimate, handleGenerate, handleImport, handleProviders, handleSaveKey, handleDeleteKey } from "@/lib/server/handlers";
import { createMemoryRateLimiter } from "@/lib/server/rate-limit";
import { decrypt, encrypt, resolveSecret } from "@/lib/server/crypto";
import { KEY_COOKIE, readKeys, resolveApiKey } from "@/lib/server/key-vault";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { createDemoProvider } from "@/lib/ai/providers/demo";
import { testConfig, testDeps, WATER_BOTTLE } from "./helpers";

const URL_BASE = "http://localhost:3000";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${URL_BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

function genBody(n: number, over: object = {}) {
  return { provider: "demo", model: "", options: {}, items: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, fields: { ...WATER_BOTTLE, name: `Bottle ${i}` } })), ...over };
}

function uploadReq(content: string, name = "products.csv", type = "text/csv") {
  const form = new FormData();
  form.set("file", new File([content], name, { type }));
  return new Request(`${URL_BASE}/api/import`, { method: "POST", body: form });
}

function cookieFrom(res: Response) {
  const c = res.headers.get("set-cookie") ?? "";
  return c.split(";")[0];
}

describe("POST /api/generate", () => {
  it("generates with the demo provider and returns per-item results", async () => {
    const res = await handleGenerate(post("/api/generate", genBody(2)), testDeps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);
    expect(body.billable).toBe(false);
  });

  it("reports partial failures without failing the request", async () => {
    const b = genBody(3);
    b.items[1].fields.name = "Bottle [demo-fail]";
    const body = await (await handleGenerate(post("/api/generate", b), testDeps())).json();
    expect(body.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, false, true]);
    expect(body.results[1].error.retryable).toBe(true);
  });

  it("validates the request body", async () => {
    expect((await handleGenerate(post("/api/generate", "{not json"), testDeps())).status).toBe(400);
    expect((await handleGenerate(post("/api/generate", { provider: "nope", items: [] }), testDeps())).status).toBe(400);
    const noName = genBody(1);
    noName.items[0].fields.name = " ";
    const r = await handleGenerate(post("/api/generate", noName), testDeps());
    expect(r.status).toBe(400);
    expect((await r.json()).error.message).toMatch(/no name/);
    const dupIds = genBody(2);
    dupIds.items[1].id = "p0";
    expect((await handleGenerate(post("/api/generate", dupIds), testDeps())).status).toBe(400);
  });

  it("enforces the batch size limit", async () => {
    const res = await handleGenerate(post("/api/generate", genBody(6)), testDeps());
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("batch_too_large");
  });

  it("rate limits per client and returns Retry-After", async () => {
    const deps = testDeps({ generateLimiter: createMemoryRateLimiter(1, 60_000) });
    expect((await handleGenerate(post("/api/generate", genBody(1), { "x-forwarded-for": "1.1.1.1" }), deps)).status).toBe(200);
    const limited = await handleGenerate(post("/api/generate", genBody(1), { "x-forwarded-for": "1.1.1.1" }), deps);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await handleGenerate(post("/api/generate", genBody(1), { "x-forwarded-for": "2.2.2.2" }), deps)).status).toBe(200);
  });

  it("requires an API key for billable providers", async () => {
    const deps = testDeps({ providers: { openai: createOpenAICompatibleProvider({ fetchImpl: (async () => new Response("{}")) as unknown as typeof fetch }) } });
    const res = await handleGenerate(post("/api/generate", genBody(1, { provider: "openai", model: "m" })), deps);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("api_key_required");
  });

  it("surfaces an invalid API key as a per-item, non-retryable error", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { message: "Incorrect API key provided" } }), { status: 401 })) as unknown as typeof fetch;
    const deps = testDeps({ config: testConfig({ openaiApiKey: "sk-server-key-123" }), providers: { openai: createOpenAICompatibleProvider({ fetchImpl }) } });
    const body = await (await handleGenerate(post("/api/generate", genBody(3, { provider: "openai", model: "m" })), deps)).json();
    expect(body.results.every((r: { ok: boolean; error: { kind: string; retryable: boolean } }) => !r.ok && r.error.kind === "invalid_api_key" && !r.error.retryable)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("sk-server-key-123");
  });

  it("rejects cross-site requests", async () => {
    const res = await handleGenerate(post("/api/generate", genBody(1), { origin: "https://evil.example" }), testDeps());
    expect(res.status).toBe(403);
  });

  it("rejects providers that are not enabled", async () => {
    const res = await handleGenerate(post("/api/generate", genBody(1, { provider: "anthropic" })), testDeps());
    expect(res.status).toBe(400);
  });
});

describe("POST /api/import", () => {
  it("parses an uploaded CSV and suggests a mapping", async () => {
    const res = await handleImport(uploadReq("SKU,Product Name,Price\nA1,Mug,4.50\n"), testDeps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headers).toEqual(["SKU", "Product Name", "Price"]);
    expect(body.suggestedMapping).toMatchObject({ sku: "SKU", name: "Product Name", price: "Price" });
  });

  it("rejects oversized, empty, wrong-type and malformed files with clear messages", async () => {
    const deps = testDeps({ config: testConfig({ maxUploadBytes: 1024 }) });
    expect((await handleImport(uploadReq("Name\n" + "x".repeat(2000)), deps)).status).toBe(413);
    expect((await handleImport(uploadReq(""), deps)).status).toBe(400);
    expect((await handleImport(uploadReq("PK...", "catalog.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), deps)).status).toBe(415);
    const malformed = await handleImport(uploadReq("Name,Price\n"), deps);
    expect(malformed.status).toBe(422);
    expect((await malformed.json()).error.message).toMatch(/no product rows/);
    const noForm = await handleImport(new Request(`${URL_BASE}/api/import`, { method: "POST", body: "x" }), deps);
    expect(noForm.status).toBe(400);
  });
});

describe("API key storage", () => {
  it("stores a customer key encrypted in an httpOnly cookie and never returns it", async () => {
    const deps = testDeps();
    const res = await handleSaveKey(post("/api/keys", { provider: "anthropic", apiKey: "sk-ant-secret-value-123456" }), deps);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).not.toContain("sk-ant-secret");
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret-value");
    expect(body.masked).toBe("sk-a…3456");

    const cookie = cookieFrom(res);
    const providersRes = handleProviders(new Request(`${URL_BASE}/api/providers`, { headers: { cookie } }), { ...deps, providers: { demo: createDemoProvider() } });
    const text = await providersRes.text();
    expect(text).not.toContain("secret-value");

    const stored = readKeys(decodeURIComponent(cookie.split("=")[1]), deps.config);
    expect(stored.anthropic).toBe("sk-ant-secret-value-123456");
  });

  it("validates keys and can be disabled", async () => {
    expect((await handleSaveKey(post("/api/keys", { provider: "anthropic", apiKey: "short" }), testDeps())).status).toBe(400);
    expect((await handleSaveKey(post("/api/keys", { provider: "anthropic", apiKey: "has spaces in it ok" }), testDeps())).status).toBe(400);
    const off = testDeps({ config: testConfig({ allowUserKeys: false }) });
    expect((await handleSaveKey(post("/api/keys", { provider: "anthropic", apiKey: "sk-ant-1234567890" }), off)).status).toBe(403);
  });

  it("deletes a stored key", async () => {
    const deps = testDeps();
    const saved = await handleSaveKey(post("/api/keys", { provider: "openai", apiKey: "sk-openai-1234567890" }), deps);
    const res = handleDeleteKey(new Request(`${URL_BASE}/api/keys?provider=openai`, { method: "DELETE", headers: { cookie: cookieFrom(saved) } }), deps);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("prefers the customer's key over the server key", () => {
    const config = testConfig({ anthropicApiKey: "server" });
    expect(resolveApiKey("anthropic", { anthropic: "user" }, config)).toEqual({ key: "user", source: "user" });
    expect(resolveApiKey("anthropic", {}, config)).toEqual({ key: "server", source: "server" });
    expect(resolveApiKey("openai", {}, config).source).toBe("none");
    expect(resolveApiKey("anthropic", { anthropic: "user" }, { ...config, allowUserKeys: false }).source).toBe("server");
  });

  it("ignores tampered or foreign cookies", () => {
    const config = testConfig();
    const sealed = encrypt(JSON.stringify({ anthropic: "x" }), config.appSecret);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(readKeys(tampered, config)).toEqual({});
    expect(readKeys(encrypt("{}", "another-secret-another-secret-another"), config)).toEqual({});
    expect(decrypt("garbage", config.appSecret)).toBeNull();
  });

  it("requires APP_SECRET in production", () => {
    expect(() => resolveSecret("", true)).toThrow(/APP_SECRET/);
    expect(resolveSecret("", false)).toHaveLength(64);
  });

  it("reads keys from the cookie by name", async () => {
    expect(KEY_COOKIE).toBe("lp_provider_keys");
  });
});

describe("POST /api/estimate", () => {
  it("estimates tokens and cost for priced models", async () => {
    const deps = testDeps({ providers: { anthropic: (await import("@/lib/ai/providers/anthropic")).createAnthropicProvider() } });
    const res = await handleEstimate(post("/api/estimate", { provider: "anthropic", model: "claude-sonnet-5-5", options: {}, items: [{ fields: WATER_BOTTLE }, { fields: WATER_BOTTLE }] }), deps);
    const body = await res.json();
    expect(body.priced).toBe(true);
    expect(body.products).toBe(2);
    expect(body.costHighUsd).toBeGreaterThan(body.costLowUsd);
    expect(body.inputTokens).toBeGreaterThan(200);
  });

  it("says when a model has no price, and uses MODEL_PRICING_JSON overrides", async () => {
    const openai = createOpenAICompatibleProvider();
    const unpriced = await (await handleEstimate(post("/api/estimate", { provider: "openai", model: "x", options: {}, items: [{ fields: WATER_BOTTLE }] }), testDeps({ providers: { openai } }))).json();
    expect(unpriced.priced).toBe(false);
    expect(unpriced.costLowUsd).toBeUndefined();
    const config = testConfig({ modelPricingJson: JSON.stringify({ "openai:x": { inputPerMTok: 1, outputPerMTok: 2 } }) });
    const priced = await (await handleEstimate(post("/api/estimate", { provider: "openai", model: "x", options: {}, items: [{ fields: WATER_BOTTLE }] }), testDeps({ config, providers: { openai } }))).json();
    expect(priced.priced).toBe(true);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window, then recovers", () => {
    let now = 0;
    const rl = createMemoryRateLimiter(2, 1000, () => now);
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(true);
    const blocked = rl.check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
    expect(rl.check("b").allowed).toBe(true);
    now = 1001;
    expect(rl.check("a").allowed).toBe(true);
  });
});
