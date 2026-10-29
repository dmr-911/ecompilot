export interface SpecPair {
  key: string;
  value: string;
}

/** Parses "Key: Value; Key: Value" or one pair per line. Items without a colon are kept with an empty key. */
export function parseSpecifications(text: string | undefined): SpecPair[] {
  if (!text) return [];
  return text
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const idx = item.search(/[:=]/);
      if (idx <= 0) return { key: "", value: item };
      return { key: item.slice(0, idx).trim(), value: item.slice(idx + 1).trim() };
    })
    .filter((p) => p.value !== "");
}

export function splitFeatures(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\s*[|\n•]\s*/)
    .map((s) => s.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
