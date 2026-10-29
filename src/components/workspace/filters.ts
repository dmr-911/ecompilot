import type { ProductRecord } from "@/lib/products/types";
import { worstSeverity } from "@/lib/quality/checks";

export const FILTERS = [
  { id: "all", label: "All" },
  { id: "valid", label: "Valid" },
  { id: "errors", label: "Has errors" },
  { id: "warnings", label: "Has warnings" },
  { id: "duplicates", label: "Duplicates" },
  { id: "pending", label: "Not generated" },
  { id: "generated", label: "Generated" },
  { id: "flagged", label: "Needs review" },
  { id: "failed", label: "Failed" },
  { id: "approved", label: "Approved" },
] as const;

export type FilterId = (typeof FILTERS)[number]["id"];

export function matchesFilter(p: ProductRecord, f: FilterId): boolean {
  switch (f) {
    case "all":
      return true;
    case "valid":
      return !p.issues.some((i) => i.severity === "error") && !p.duplicateOf;
    case "errors":
      return p.issues.some((i) => i.severity === "error");
    case "warnings":
      return p.issues.some((i) => i.severity === "warning");
    case "duplicates":
      return Boolean(p.duplicateOf);
    case "pending":
      return !p.generated && p.status !== "error";
    case "generated":
      return Boolean(p.generated);
    case "flagged":
      return Boolean(p.generated) && ["error", "warning"].includes(worstSeverity(p.flags) ?? "");
    case "failed":
      return p.status === "error";
    case "approved":
      return p.approved;
  }
}

export function matchesSearch(p: ProductRecord, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const l = p.edited ?? p.generated;
  return [p.fields.name, p.fields.sku, p.fields.brand, p.fields.category, l?.title].some((v) => v?.toLowerCase().includes(needle));
}
