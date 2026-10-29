import { ProviderError } from "../errors";
import type { AIProvider, StructuredRequest, StructuredResult } from "../types";
import { parseSpecifications, splitFeatures } from "../../products/specs";
import { slugify, truncate } from "../../export/format";

/**
 * Template-based generator for demo mode. It makes no network calls, costs
 * nothing, and only rearranges the supplied facts. It is clearly labelled as
 * demo output in the UI and is not a substitute for a real model.
 */
export const DEMO_MODEL = "demo-template-v1";

function readField(prompt: string, label: string): string | undefined {
  const m = prompt.match(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}: (.*)$`, "m"));
  return m?.[1]?.trim() || undefined;
}

function sentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const cap = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}

export function demoListing(prompt: string, system: string) {
  const name = readField(prompt, "Product name") ?? "Product";
  const brand = readField(prompt, "Brand");
  const category = readField(prompt, "Category");
  const color = readField(prompt, "Color");
  const size = readField(prompt, "Size");
  const materials = readField(prompt, "Materials / ingredients");
  const dimensions = readField(prompt, "Dimensions");
  const weight = readField(prompt, "Weight");
  const description = readField(prompt, "Existing description");
  const specs = parseSpecifications(readField(prompt, "Specifications"));
  const features = splitFeatures(readField(prompt, "Existing features"));
  const keywords = (readField(prompt, "Seed keywords") ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  const titleMax = Number(system.match(/title: at most (\d+)/)?.[1] ?? 150);
  const bulletCount = Number(system.match(/exactly (\d+) feature bullets/)?.[1] ?? 5);
  const faqMax = Number(system.match(/faqs: up to (\d+)/)?.[1] ?? 4);
  const nonEnglish = !/Language: write every field in English/.test(system);

  const nameHasBrand = brand && name.toLowerCase().includes(brand.toLowerCase());
  const attrs = [size, color].filter(Boolean).join(", ");
  const title = truncate([nameHasBrand ? undefined : brand, name].filter(Boolean).join(" ") + (attrs ? ` - ${attrs}` : ""), titleMax);

  const factLines = specs.map((s) => (s.key ? `${s.key}: ${s.value}` : s.value));
  const bulletSources = [
    ...features,
    ...specs.map((s) => (s.key ? `${s.key}: ${s.value}` : s.value)),
    materials ? `Materials: ${materials}` : undefined,
    dimensions ? `Dimensions: ${dimensions}` : undefined,
    weight ? `Weight: ${weight}` : undefined,
  ].filter((x): x is string => Boolean(x));
  const bullets = Array.from(new Set(bulletSources)).slice(0, bulletCount).map(sentence);

  const intro = description ? sentence(description) : `${brand ? `${brand} ` : ""}${name}${category ? `, in ${category}` : ""}.`;
  const shortDescription = truncate(intro, 300);
  const longParts = [intro];
  if (factLines.length) longParts.push(`Key details: ${factLines.join("; ")}.`);
  if (materials) longParts.push(`Materials: ${materials}.`);

  const faqs = specs
    .filter((s) => s.key)
    .slice(0, faqMax)
    .map((s) => ({ question: `What is the ${s.key.toLowerCase()} of the ${name}?`, answer: sentence(s.value) }));

  const missing: string[] = [];
  if (!dimensions && !specs.some((s) => /dimension|size/i.test(s.key))) missing.push("Dimensions");
  if (!materials && !specs.some((s) => /material/i.test(s.key))) missing.push("Materials");
  if (!description && specs.length === 0 && features.length === 0) missing.push("Product specifications or description");
  if (nonEnglish) missing.push("Demo mode writes in English only; connect an AI provider for other languages");

  return {
    title,
    shortDescription,
    longDescription: longParts.join("\n\n"),
    bullets,
    faqs,
    seo: {
      metaTitle: truncate(title, 60),
      metaDescription: truncate(shortDescription, 160),
      keywords: Array.from(new Set([...keywords, category, brand].filter((k): k is string => Boolean(k)).map((k) => k.toLowerCase()))),
      urlSlug: slugify([brand, name].filter(Boolean).join(" ")),
    },
    missingInformation: missing,
  };
}

export function createDemoProvider(opts: { delayMs?: number } = {}): AIProvider {
  const delayMs = opts.delayMs ?? 250;
  return {
    id: "demo",
    label: "Demo (template, no AI, free)",
    billable: false,
    defaultModel: DEMO_MODEL,
    models: [{ id: DEMO_MODEL, label: "Demo template", inputPerMTok: 0, outputPerMTok: 0 }],
    allowCustomModel: false,
    async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (req.signal?.aborted) throw new ProviderError("cancelled", "Request was cancelled.");
      // Lets demos and tests exercise the failure path deterministically.
      if (/\[demo-fail\]/i.test(req.prompt)) throw new ProviderError("provider_unavailable", "Simulated provider failure (demo).");
      const checked = req.schema.safeParse(demoListing(req.prompt, req.system));
      if (!checked.success) throw new ProviderError("invalid_output", "Demo output did not match the schema.");
      return { output: checked.data, usage: { inputTokens: 0, outputTokens: 0 }, model: DEMO_MODEL };
    },
  };
}
