import type { ModelInfo } from "./types";

export interface PriceEntry {
  inputPerMTok: number;
  outputPerMTok: number;
}

/**
 * Parses MODEL_PRICING_JSON, e.g. {"openai:my-model":{"inputPerMTok":2,"outputPerMTok":8}}.
 * Lets operators keep prices current without a code change.
 */
export function parsePricingOverrides(json: string): Record<string, PriceEntry> {
  if (!json.trim()) return {};
  try {
    const raw = JSON.parse(json) as Record<string, Partial<PriceEntry>>;
    const out: Record<string, PriceEntry> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v?.inputPerMTok === "number" && typeof v?.outputPerMTok === "number") {
        out[k] = { inputPerMTok: v.inputPerMTok, outputPerMTok: v.outputPerMTok };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function lookupPrice(providerId: string, model: string, models: ModelInfo[], overrides: Record<string, PriceEntry>): PriceEntry | undefined {
  const o = overrides[`${providerId}:${model}`];
  if (o) return o;
  const m = models.find((x) => x.id === model);
  if (m && m.inputPerMTok !== undefined && m.outputPerMTok !== undefined) {
    return { inputPerMTok: m.inputPerMTok, outputPerMTok: m.outputPerMTok };
  }
  return undefined;
}

/** Rough token count: ~4 characters per token for Latin scripts, ~1.5 for CJK. Deliberately conservative. */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) ?? []).length;
  return Math.ceil((text.length - cjk) / 3.5 + cjk / 1.5);
}

/**
 * Output size range per listing. The high end allows for model reasoning
 * tokens, which most current models bill as output.
 */
export const OUTPUT_TOKENS_PER_LISTING = { low: 900, high: 4000 } as const;

export interface CostEstimate {
  products: number;
  inputTokens: number;
  outputTokensLow: number;
  outputTokensHigh: number;
  costLowUsd?: number;
  costHighUsd?: number;
  priced: boolean;
}

export function estimateCost(inputTokensPerProduct: number[], price: PriceEntry | undefined): CostEstimate {
  const inputTokens = inputTokensPerProduct.reduce((a, b) => a + b, 0);
  const n = inputTokensPerProduct.length;
  const outLow = n * OUTPUT_TOKENS_PER_LISTING.low;
  const outHigh = n * OUTPUT_TOKENS_PER_LISTING.high;
  if (!price) return { products: n, inputTokens, outputTokensLow: outLow, outputTokensHigh: outHigh, priced: false };
  const cost = (inTok: number, outTok: number) => (inTok * price.inputPerMTok + outTok * price.outputPerMTok) / 1_000_000;
  return {
    products: n,
    inputTokens,
    outputTokensLow: outLow,
    outputTokensHigh: outHigh,
    costLowUsd: cost(inputTokens, outLow),
    costHighUsd: cost(inputTokens, outHigh),
    priced: true,
  };
}
