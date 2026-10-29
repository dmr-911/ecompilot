import { productFieldsSchema } from "../products/schema";
import type { ProductFieldKey, ProductFields } from "../products/fields";
import type { ProductRecord, RowIssue } from "../products/types";
import type { CsvParseIssue, ParsedCsv } from "./parse";
import { applyMapping, type ColumnMapping } from "./mapping";

export interface ValidatedImport {
  records: ProductRecord[];
  summary: {
    total: number;
    valid: number;
    withErrors: number;
    withWarnings: number;
    duplicates: number;
  };
  fileIssues: CsvParseIssue[];
}

export function validateFields(fields: ProductFields): { fields: ProductFields; issues: RowIssue[] } {
  const parsed = productFieldsSchema.safeParse(fields);
  const issues: RowIssue[] = [];
  if (parsed.success) {
    const out: ProductFields = {};
    for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) out[k as ProductFieldKey] = v;
    issues.push(...completenessWarnings(out));
    return { fields: out, issues };
  }
  for (const issue of parsed.error.issues) {
    issues.push({ field: issue.path[0] as ProductFieldKey, severity: "error", message: issue.message });
  }
  issues.push(...completenessWarnings(fields));
  // Keep raw values so the user can fix them in the editor.
  return { fields, issues };
}

/** Non-blocking warnings about thin source data that will limit output quality. */
export function completenessWarnings(fields: ProductFields): RowIssue[] {
  const w: RowIssue[] = [];
  if (!fields.specifications && !fields.description && !fields.features) {
    w.push({ severity: "warning", message: "No specifications, description, or features. Output will be generic and flagged for review." });
  }
  if (!fields.sku) w.push({ field: "sku", severity: "warning", message: "No SKU; duplicates are detected by name only." });
  if (fields.price && !fields.currency) w.push({ field: "currency", severity: "warning", message: "Price has no currency; USD will be assumed on export." });
  return w;
}

export function duplicateKey(fields: ProductFields): { bySku?: string; byName?: string } {
  const sku = fields.sku?.trim().toLowerCase();
  const name = fields.name
    ?.toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const brand = fields.brand?.trim().toLowerCase() ?? "";
  return { bySku: sku || undefined, byName: name ? `${brand}|${name}|${fields.size ?? ""}|${fields.color ?? ""}`.toLowerCase() : undefined };
}

/** Marks every record after the first that shares a SKU, or (lacking SKUs) the same brand+name+variant. */
export function markDuplicates(records: ProductRecord[]): ProductRecord[] {
  const bySku = new Map<string, string>();
  const byName = new Map<string, string>();
  return records.map((r) => {
    const key = duplicateKey(r.fields);
    let dupOf: string | undefined;
    let reason = "";
    if (key.bySku) {
      dupOf = bySku.get(key.bySku);
      reason = `Duplicate SKU "${r.fields.sku}"`;
      if (!dupOf) bySku.set(key.bySku, r.id);
    }
    if (!dupOf && key.byName && !key.bySku) {
      dupOf = byName.get(key.byName);
      reason = "Same brand, name, size and color as another row";
    }
    if (key.byName && !byName.has(key.byName)) byName.set(key.byName, r.id);
    const issues = r.issues.filter((i) => !i.message.startsWith("Duplicate of row") );
    if (dupOf) {
      const original = records.find((x) => x.id === dupOf);
      issues.push({ field: "sku", severity: "warning", message: `Duplicate of row ${original?.sourceRow ?? "?"}: ${reason}.` });
    }
    return { ...r, duplicateOf: dupOf, issues };
  });
}

let counter = 0;
export function newId(): string {
  counter += 1;
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `p_${Date.now().toString(36)}_${counter}_${rand}`;
}

export function buildRecords(parsed: ParsedCsv, mapping: ColumnMapping): ValidatedImport {
  const rowIssues = new Map<number, RowIssue[]>();
  const fileIssues: CsvParseIssue[] = [];
  for (const issue of parsed.issues) {
    if (issue.row && issue.row > 1) {
      rowIssues.set(issue.row, [...(rowIssues.get(issue.row) ?? []), { severity: issue.severity, message: issue.message }]);
    } else {
      fileIssues.push(issue);
    }
  }

  const now = Date.now();
  let records: ProductRecord[] = parsed.rows.map((row, i) => {
    const sourceRow = parsed.rowNumbers[i];
    const { fields, issues } = validateFields(applyMapping(row, mapping));
    return {
      id: newId(),
      sourceRow,
      fields,
      issues: [...(rowIssues.get(sourceRow) ?? []), ...issues],
      status: "idle",
      flags: [],
      approved: false,
      updatedAt: now,
    };
  });
  records = markDuplicates(records);

  return { records, summary: summarize(records), fileIssues };
}

export function summarize(records: ProductRecord[]): ValidatedImport["summary"] {
  return {
    total: records.length,
    valid: records.filter((r) => !r.issues.some((i) => i.severity === "error")).length,
    withErrors: records.filter((r) => r.issues.some((i) => i.severity === "error")).length,
    withWarnings: records.filter((r) => r.issues.some((i) => i.severity === "warning")).length,
    duplicates: records.filter((r) => r.duplicateOf).length,
  };
}
