import type { ProductFields } from "../products/fields";
import type { GeneratedListing } from "../prompts/output-schema";
import type { GenerationOptions } from "../generation/options";
import { getAdapter } from "../export/registry";
import { CLAIM_PATTERNS } from "./claims";

export type FlagSeverity = "error" | "warning" | "info";

export interface QualityFlag {
  severity: FlagSeverity;
  code:
    | "unsupported_claim"
    | "unsupported_number"
    | "prohibited_phrase"
    | "required_keyword_missing"
    | "length_exceeded"
    | "bullet_count"
    | "keyword_limit"
    | "empty_field"
    | "missing_information"
    | "thin_source_data"
    | "html_in_output";
  message: string;
  field?: string;
}

function sourceText(fields: ProductFields): string {
  return Object.entries(fields)
    .filter(([k]) => k !== "imageUrl")
    .map(([, v]) => v ?? "")
    .join("\n");
}

function listingTexts(l: GeneratedListing): { field: string; text: string }[] {
  return [
    { field: "title", text: l.title },
    { field: "shortDescription", text: l.shortDescription },
    { field: "longDescription", text: l.longDescription },
    ...l.bullets.map((b, i) => ({ field: `bullets.${i}`, text: b })),
    ...l.faqs.flatMap((f, i) => [
      { field: `faqs.${i}.question`, text: f.question },
      { field: `faqs.${i}.answer`, text: f.answer },
    ]),
    { field: "seo.metaTitle", text: l.seo.metaTitle },
    { field: "seo.metaDescription", text: l.seo.metaDescription },
    ...l.seo.keywords.map((k, i) => ({ field: `seo.keywords.${i}`, text: k })),
  ];
}

const NUMBER = /\d+(?:[.,]\d+)?/g;

function normalizeNumber(n: string): string {
  const s = n.replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? String(v) : s;
}

function numbersIn(text: string): Set<string> {
  return new Set((text.match(NUMBER) ?? []).map(normalizeNumber));
}

const NO_WORD_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

/** Case-insensitive phrase search that respects word boundaries where the phrase starts/ends with a letter or digit. */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.trim();
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  // Scripts written without spaces between words (CJK, Thai) get no boundary check.
  const needsBoundary = (ch: string) => /[\p{L}\p{N}]/u.test(ch) && !NO_WORD_SPACES.test(ch);
  const start = needsBoundary(p[0]) ? "(?<![\\p{L}\\p{N}])" : "";
  const end = needsBoundary(p[p.length - 1]) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${start}${escaped}${end}`, "iu").test(haystack);
}

/**
 * Deterministic checks run on every generated listing. They do not replace
 * human review; they point the reviewer at the most likely problems.
 */
export function runQualityChecks(fields: ProductFields, listing: GeneratedListing, options: GenerationOptions): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const c = getAdapter(options.marketplace).constraints;
  const source = sourceText(fields);
  const texts = listingTexts(listing);

  // Unsupported claims
  for (const claim of CLAIM_PATTERNS) {
    const support = claim.support ?? claim.pattern;
    if (support.test(source)) continue;
    const hit = texts.find((t) => claim.pattern.test(t.text));
    if (hit) {
      const match = hit.text.match(claim.pattern)?.[0] ?? claim.label;
      flags.push({
        severity: "error",
        code: "unsupported_claim",
        field: hit.field,
        message: `Possible unsupported ${claim.label}: "${match}" is not in the source data. Remove it or add the fact to the product data.`,
      });
    }
  }

  // Numbers that do not appear in the source data (possible altered specifications)
  const sourceNumbers = numbersIn(source + "\n" + options.requiredKeywords.join(" "));
  const reported = new Set<string>();
  for (const t of texts) {
    if (t.field.startsWith("seo.keywords")) continue;
    for (const raw of t.text.match(NUMBER) ?? []) {
      const n = normalizeNumber(raw);
      if (sourceNumbers.has(n) || reported.has(n)) continue;
      // Small counting words like "2 pockets" are usually derived from the data; still worth a look.
      reported.add(n);
      flags.push({
        severity: "warning",
        code: "unsupported_number",
        field: t.field,
        message: `The number "${raw}" does not appear in the source data. Check it matches the specifications.`,
      });
    }
  }

  // Prohibited phrases
  for (const phrase of options.prohibitedPhrases) {
    const hit = texts.find((t) => containsPhrase(t.text, phrase));
    if (hit) {
      flags.push({ severity: "error", code: "prohibited_phrase", field: hit.field, message: `Contains prohibited phrase "${phrase}".` });
    }
  }

  // Required keywords (in the main copy, not only in SEO keywords)
  const mainCopy = [listing.title, listing.shortDescription, listing.longDescription, ...listing.bullets].join("\n");
  for (const kw of options.requiredKeywords) {
    if (!containsPhrase(mainCopy, kw)) {
      flags.push({ severity: "warning", code: "required_keyword_missing", message: `Required keyword "${kw}" is not in the title, descriptions or bullets.` });
    }
  }

  // Lengths
  const lengthChecks: [string, string, number][] = [
    ["title", listing.title, c.titleMaxLength],
    ["shortDescription", listing.shortDescription, c.shortDescriptionMaxLength],
    ["longDescription", listing.longDescription, c.longDescriptionMaxLength],
    ["seo.metaTitle", listing.seo.metaTitle, c.metaTitleMaxLength],
    ["seo.metaDescription", listing.seo.metaDescription, c.metaDescriptionMaxLength],
  ];
  for (const [field, text, max] of lengthChecks) {
    if (text.trim() === "") {
      flags.push({ severity: field === "title" ? "error" : "warning", code: "empty_field", field, message: `${field} is empty.` });
    } else if (text.length > max) {
      flags.push({ severity: "warning", code: "length_exceeded", field, message: `${field} is ${text.length} characters; the ${getAdapter(options.marketplace).name} limit is ${max}.` });
    }
  }
  listing.bullets.forEach((b, i) => {
    if (b.length > c.bulletMaxLength) {
      flags.push({ severity: "warning", code: "length_exceeded", field: `bullets.${i}`, message: `Bullet ${i + 1} is ${b.length} characters; the limit is ${c.bulletMaxLength}.` });
    }
  });
  if (listing.bullets.length !== c.bulletCount) {
    flags.push({ severity: "info", code: "bullet_count", field: "bullets", message: `${listing.bullets.length} bullets; ${c.bulletCount} expected for this marketplace.` });
  }
  if (listing.seo.keywords.length > c.keywordLimit) {
    flags.push({ severity: "warning", code: "keyword_limit", field: "seo.keywords", message: `${listing.seo.keywords.length} keywords; the limit is ${c.keywordLimit}. Extra keywords are dropped on export where the marketplace enforces a limit.` });
  }
  if (c.keywordMaxLength) {
    const long = listing.seo.keywords.filter((k) => k.length > c.keywordMaxLength!);
    if (long.length) {
      flags.push({ severity: "warning", code: "keyword_limit", field: "seo.keywords", message: `${long.length} keyword(s) are longer than ${c.keywordMaxLength} characters and will be dropped on export: ${long.join(", ")}.` });
    }
  }
  if (texts.some((t) => /<\/?[a-z][^>]*>/i.test(t.text))) {
    flags.push({ severity: "info", code: "html_in_output", message: "Output contains HTML tags. They are escaped on export." });
  }

  // Missing information reported by the model, plus our own source-data checks
  for (const m of listing.missingInformation) {
    flags.push({ severity: "info", code: "missing_information", message: `Missing information: ${m}` });
  }
  if (!fields.specifications && !fields.description && !fields.features) {
    flags.push({ severity: "warning", code: "thin_source_data", message: "The source data had no specifications, description or features, so the copy is generic. Add facts and regenerate." });
  }

  return flags;
}

export function worstSeverity(flags: QualityFlag[]): FlagSeverity | undefined {
  if (flags.some((f) => f.severity === "error")) return "error";
  if (flags.some((f) => f.severity === "warning")) return "warning";
  if (flags.length) return "info";
  return undefined;
}
