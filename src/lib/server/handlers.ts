import { estimateRequestSchema, generateRequestSchema, saveKeyRequestSchema, type ProvidersResponse } from "../api/schemas";
import type { AIProvider, ProviderId } from "../ai/types";
import { estimateCost, estimateTokens, lookupPrice, parsePricingOverrides } from "../ai/pricing";
import { buildSystemPrompt, buildUserPrompt } from "../prompts/templates";
import { generateBatch } from "../generation/service";
import { parseCsv, CsvError } from "../csv/parse";
import { suggestMapping } from "../csv/mapping";
import { CSV_LIMITS } from "../csv/limits";
import { apiError, getCookie, json, readJson, sameOrigin, serializeCookie, zodDetails } from "./http";
import { KEY_COOKIE, KEY_COOKIE_MAX_AGE, maskKey, readKeys, resolveApiKey, sealKeys } from "./key-vault";
import { clientKey, type RateLimiter } from "./rate-limit";
import type { AppConfig } from "./config";

/** Everything a handler needs, injected so handlers are testable without Next.js. */
export interface HandlerDeps {
  config: AppConfig;
  providers: Partial<Record<ProviderId, AIProvider>>;
  generateLimiter: RateLimiter;
  importLimiter: RateLimiter;
}

const JSON_LIMIT = 2 * 1024 * 1024;

function resolveModel(provider: AIProvider, requested: string): { ok: true; model: string } | { ok: false; response: Response } {
  const model = requested || provider.defaultModel;
  if (!model) return { ok: false, response: apiError(400, "model_required", "Choose a model for this provider in Settings.") };
  if (!provider.allowCustomModel && !provider.models.some((m) => m.id === model)) {
    return { ok: false, response: apiError(400, "unknown_model", `Unknown model "${model}" for ${provider.label}.`) };
  }
  return { ok: true, model };
}

export function handleProviders(request: Request, deps: HandlerDeps): Response {
  const { config } = deps;
  const stored = readKeys(getCookie(request, KEY_COOKIE), config);
  const overrides = parsePricingOverrides(config.modelPricingJson);
  const body: ProvidersResponse = {
    providers: Object.values(deps.providers).map((p) => {
      const { key, source } = resolveApiKey(p.id, stored, config);
      return {
        id: p.id,
        label: p.label,
        billable: p.billable,
        defaultModel: p.defaultModel,
        allowCustomModel: p.allowCustomModel,
        models: p.models.map((m) => ({ id: m.id, label: m.label, note: m.note, priced: Boolean(lookupPrice(p.id, m.id, p.models, overrides)) })),
        // Server keys are never masked-and-shown; only that one exists.
        key: { source, masked: source === "user" ? maskKey(key) : undefined },
      };
    }),
    limits: {
      maxBatchSize: config.maxBatchSize,
      maxProductsPerJob: config.maxProductsPerJob,
      maxUploadBytes: config.maxUploadBytes,
      rateLimitPerMinute: config.rateLimitPerMinute,
    },
    allowUserKeys: config.allowUserKeys,
    storage: { enabled: config.storageDriver !== "none", driver: config.storageDriver },
  };
  return json(body);
}

export async function handleSaveKey(request: Request, deps: HandlerDeps): Promise<Response> {
  const { config } = deps;
  if (!sameOrigin(request)) return apiError(403, "forbidden", "Cross-site request rejected.");
  if (!config.allowUserKeys) return apiError(403, "user_keys_disabled", "This installation does not accept customer API keys.");
  const read = await readJson(request, 8 * 1024);
  if (!read.ok) return read.response;
  const parsed = saveKeyRequestSchema.safeParse(read.body);
  if (!parsed.success) return apiError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.", { details: zodDetails(parsed.error) });

  const stored = readKeys(getCookie(request, KEY_COOKIE), config);
  stored[parsed.data.provider] = parsed.data.apiKey;
  let sealed: string;
  try {
    sealed = sealKeys(stored, config);
  } catch (err) {
    return apiError(500, "server_misconfigured", err instanceof Error ? err.message : "Key storage is not configured.");
  }
  return json(
    { ok: true, provider: parsed.data.provider, masked: maskKey(parsed.data.apiKey) },
    { headers: { "set-cookie": serializeCookie(KEY_COOKIE, sealed, { maxAge: KEY_COOKIE_MAX_AGE, secure: config.isProduction }) } },
  );
}

export function handleDeleteKey(request: Request, deps: HandlerDeps): Response {
  const { config } = deps;
  if (!sameOrigin(request)) return apiError(403, "forbidden", "Cross-site request rejected.");
  const provider = new URL(request.url).searchParams.get("provider");
  if (provider !== "anthropic" && provider !== "openai") return apiError(400, "invalid_request", "provider must be anthropic or openai.");
  const stored = readKeys(getCookie(request, KEY_COOKIE), config);
  delete stored[provider];
  const empty = Object.keys(stored).length === 0;
  let cookie: string;
  try {
    cookie = empty
      ? serializeCookie(KEY_COOKIE, "", { maxAge: 0, secure: config.isProduction })
      : serializeCookie(KEY_COOKIE, sealKeys(stored, config), { maxAge: KEY_COOKIE_MAX_AGE, secure: config.isProduction });
  } catch {
    cookie = serializeCookie(KEY_COOKIE, "", { maxAge: 0, secure: config.isProduction });
  }
  return json({ ok: true }, { headers: { "set-cookie": cookie } });
}

export async function handleImport(request: Request, deps: HandlerDeps): Promise<Response> {
  const { config } = deps;
  const limit = deps.importLimiter.check(clientKey(request.headers));
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Too many uploads. Wait a moment and try again.", { retryAfterMs: limit.retryAfterMs }, { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) });
  }
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > config.maxUploadBytes + 64 * 1024) return apiError(413, "file_too_large", `The file is larger than ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "invalid_upload", "Upload a CSV file using the form field \"file\".");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return apiError(400, "invalid_upload", "Upload a CSV file using the form field \"file\".");
  if (file.size > config.maxUploadBytes) return apiError(413, "file_too_large", `The file is larger than ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`);
  if (file.size === 0) return apiError(400, "empty_file", "The file is empty.");
  const name = file.name.toLowerCase();
  if (!/\.(csv|tsv|txt)$/.test(name) && !/(csv|text|excel)/.test(file.type)) {
    return apiError(415, "unsupported_type", "Upload a .csv file. For Excel workbooks, use File > Save As > CSV UTF-8.");
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer());
    const parsed = parseCsv(text, { maxRows: Math.min(CSV_LIMITS.maxRows, config.maxProductsPerJob * 10) });
    return json({ ...parsed, suggestedMapping: suggestMapping(parsed.headers), fileName: file.name });
  } catch (err) {
    if (err instanceof CsvError) return apiError(422, "invalid_csv", err.message);
    throw err;
  }
}

export async function handleEstimate(request: Request, deps: HandlerDeps): Promise<Response> {
  const read = await readJson(request, JSON_LIMIT * 5);
  if (!read.ok) return read.response;
  const parsed = estimateRequestSchema.safeParse(read.body);
  if (!parsed.success) return apiError(400, "invalid_request", "Invalid estimate request.", { details: zodDetails(parsed.error) });
  const { provider: providerId, options, items } = parsed.data;
  const provider = deps.providers[providerId];
  if (!provider) return apiError(400, "provider_unavailable", "That provider is not enabled on this server.");
  const model = parsed.data.model || provider.defaultModel;
  const system = buildSystemPrompt(options);
  const systemTokens = estimateTokens(system);
  const perProduct = items.map((i) => systemTokens + estimateTokens(buildUserPrompt(i.fields)));
  const price = provider.billable ? lookupPrice(providerId, model, provider.models, parsePricingOverrides(deps.config.modelPricingJson)) : { inputPerMTok: 0, outputPerMTok: 0 };
  return json({
    ...estimateCost(perProduct, price),
    provider: providerId,
    model,
    billable: provider.billable,
    batches: Math.ceil(items.length / deps.config.maxBatchSize),
    overJobLimit: items.length > deps.config.maxProductsPerJob,
    maxProductsPerJob: deps.config.maxProductsPerJob,
  });
}

export async function handleGenerate(request: Request, deps: HandlerDeps): Promise<Response> {
  const { config } = deps;
  if (!sameOrigin(request)) return apiError(403, "forbidden", "Cross-site request rejected.");

  const read = await readJson(request, JSON_LIMIT);
  if (!read.ok) return read.response;
  const parsed = generateRequestSchema.safeParse(read.body);
  if (!parsed.success) return apiError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.", { details: zodDetails(parsed.error) });
  const { provider: providerId, options, items } = parsed.data;

  if (items.length > config.maxBatchSize) {
    return apiError(413, "batch_too_large", `Send at most ${config.maxBatchSize} products per request. The app splits larger jobs automatically.`);
  }
  if (new Set(items.map((i) => i.id)).size !== items.length) return apiError(400, "invalid_request", "Item ids must be unique.");
  const missingName = items.find((i) => !i.fields.name?.trim());
  if (missingName) return apiError(400, "invalid_request", `Product ${missingName.id} has no name. Fix it before generating.`);

  const provider = deps.providers[providerId];
  if (!provider) return apiError(400, "provider_unavailable", "That provider is not enabled on this server.");
  const model = resolveModel(provider, parsed.data.model);
  if (!model.ok) return model.response;

  const { key, source } = resolveApiKey(providerId, readKeys(getCookie(request, KEY_COOKIE), config), config);
  if (provider.billable && source === "none") {
    return apiError(401, "api_key_required", `Add your ${provider.label} API key in Settings, or choose the demo provider.`);
  }

  const limit = deps.generateLimiter.check(clientKey(request.headers));
  if (!limit.allowed) {
    return apiError(
      429,
      "rate_limited",
      `Rate limit reached (${config.rateLimitPerMinute} requests per minute). The app will retry automatically.`,
      { retryAfterMs: limit.retryAfterMs },
      { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) },
    );
  }

  const results = await generateBatch(items, {
    provider,
    model: model.model,
    apiKey: key,
    options,
    concurrency: config.concurrency,
    maxOutputTokens: config.maxOutputTokens,
    signal: request.signal,
  });
  return json({ results, provider: providerId, model: model.model, billable: provider.billable });
}
