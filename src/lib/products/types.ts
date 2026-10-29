import type { ProductFieldKey, ProductFields } from "./fields";
import type { GeneratedListing } from "../prompts/output-schema";
import type { QualityFlag } from "../quality/checks";
import type { ProviderErrorKind } from "../ai/errors";

export interface RowIssue {
  field?: ProductFieldKey;
  severity: "error" | "warning";
  message: string;
}

export type GenerationStatus = "idle" | "queued" | "generating" | "done" | "error";

export interface ProductRecord {
  id: string;
  /** 1-based row number in the source CSV (header is row 1, so data starts at 2). */
  sourceRow: number;
  fields: ProductFields;
  issues: RowIssue[];
  /** id of the first record this one duplicates, if any. */
  duplicateOf?: string;
  status: GenerationStatus;
  error?: { kind: ProviderErrorKind | "validation"; message: string; retryable: boolean };
  /** Output exactly as the model returned it (after schema validation). */
  generated?: GeneratedListing;
  /** User-edited version; export prefers this when present. */
  edited?: GeneratedListing;
  flags: QualityFlag[];
  approved: boolean;
  usage?: { inputTokens: number; outputTokens: number; model: string };
  updatedAt: number;
}

export function currentListing(p: ProductRecord): GeneratedListing | undefined {
  return p.edited ?? p.generated;
}

export function hasBlockingIssues(p: ProductRecord): boolean {
  return p.issues.some((i) => i.severity === "error");
}
