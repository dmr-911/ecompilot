import { PRODUCT_FIELDS, type ProductFieldKey, type ProductFields } from "../products/fields";

/** Maps each standard field to the source header that feeds it (or null when unmapped). */
export type ColumnMapping = Partial<Record<ProductFieldKey, string | null>>;

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\(\d+\)$/, "")
    .trim();
}

/**
 * Suggests a mapping by matching headers against each field's synonyms.
 * Exact synonym matches win over partial matches; each header is used once.
 */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const normalized = headers.map((h) => ({ header: h, norm: normalizeHeader(h) }));

  // Pass 1: exact matches
  for (const field of PRODUCT_FIELDS) {
    const synonyms = field.synonyms.map(normalizeHeader);
    const hit = normalized.find((h) => !used.has(h.header) && synonyms.includes(h.norm));
    if (hit) {
      mapping[field.key] = hit.header;
      used.add(hit.header);
    }
  }
  // Pass 2: header contains a multi-word synonym (e.g. "Product Specifications (EN)")
  for (const field of PRODUCT_FIELDS) {
    if (mapping[field.key]) continue;
    const synonyms = field.synonyms.map(normalizeHeader).filter((s) => s.length >= 4);
    const hit = normalized.find((h) => !used.has(h.header) && synonyms.some((s) => h.norm.includes(s)));
    if (hit) {
      mapping[field.key] = hit.header;
      used.add(hit.header);
    }
  }
  return mapping;
}

export function mappingProblems(mapping: ColumnMapping, headers: string[]): string[] {
  const problems: string[] = [];
  for (const field of PRODUCT_FIELDS) {
    const h = mapping[field.key];
    if (field.required && !h) problems.push(`Map a column to "${field.label}" (required).`);
    if (h && !headers.includes(h)) problems.push(`"${field.label}" is mapped to a column that does not exist: "${h}".`);
  }
  const counts = new Map<string, ProductFieldKey[]>();
  for (const [key, h] of Object.entries(mapping) as [ProductFieldKey, string | null][]) {
    if (!h) continue;
    counts.set(h, [...(counts.get(h) ?? []), key]);
  }
  for (const [h, keys] of counts) {
    if (keys.length > 1) problems.push(`Column "${h}" is mapped to more than one field (${keys.join(", ")}).`);
  }
  return problems;
}

export function applyMapping(row: Record<string, string>, mapping: ColumnMapping): ProductFields {
  const fields: ProductFields = {};
  for (const [key, header] of Object.entries(mapping) as [ProductFieldKey, string | null][]) {
    if (!header) continue;
    const value = row[header];
    if (value !== undefined && value.trim() !== "") fields[key] = value.trim();
  }
  return fields;
}
