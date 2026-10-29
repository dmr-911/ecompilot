"use client";

import type { ApiErrorBody, EstimateRequest, GenerateRequest, ProvidersResponse } from "@/lib/api/schemas";
import type { GenerationItemResult } from "@/lib/generation/service";
import type { CostEstimate } from "@/lib/ai/pricing";
import type { ImportState } from "@/lib/workspace/reducer";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Could not reach the ListingPilot server. Check your connection.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const retryAfter = body?.error.retryAfterMs ?? (Number(res.headers.get("retry-after")) * 1000 || undefined);
    throw new ApiError(res.status, body?.error.code ?? "http_error", body?.error.message ?? `Request failed (HTTP ${res.status}).`, retryAfter);
  }
  return (await res.json()) as T;
}

const jsonInit = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

export const api = {
  providers: () => call<ProvidersResponse>("/api/providers", { cache: "no-store" }),
  saveKey: (provider: "anthropic" | "openai", apiKey: string) =>
    call<{ ok: true; masked: string }>("/api/keys", jsonInit("POST", { provider, apiKey })),
  deleteKey: (provider: "anthropic" | "openai") => call<{ ok: true }>(`/api/keys?provider=${provider}`, { method: "DELETE" }),
  importCsv: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return call<ImportState>("/api/import", { method: "POST", body: form });
  },
  estimate: (req: EstimateRequest) =>
    call<CostEstimate & { billable: boolean; batches: number; overJobLimit: boolean; maxProductsPerJob: number; model: string }>(
      "/api/estimate",
      jsonInit("POST", req),
    ),
  generate: (req: GenerateRequest, signal?: AbortSignal) =>
    call<{ results: GenerationItemResult[]; model: string; billable: boolean }>("/api/generate", jsonInit("POST", req, signal)),
};
