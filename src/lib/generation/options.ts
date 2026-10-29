import { z } from "zod";

export const TONES = [
  { id: "professional", label: "Professional", guidance: "Clear, confident and trustworthy. No slang." },
  { id: "friendly", label: "Friendly", guidance: "Warm and conversational, like a helpful shop assistant." },
  { id: "luxury", label: "Premium", guidance: "Refined and understated. Emphasise craft and materials that are stated in the data." },
  { id: "playful", label: "Playful", guidance: "Upbeat and light, with energy, but never at the expense of accuracy." },
  { id: "technical", label: "Technical", guidance: "Precise and specification-led, for expert buyers." },
  { id: "minimal", label: "Minimal", guidance: "Short sentences. Only what matters." },
] as const;

export const STYLES = [
  { id: "benefit-led", label: "Benefit-led", guidance: "Lead with what the buyer gets, then back each benefit with a stated fact." },
  { id: "feature-focused", label: "Feature-focused", guidance: "Lead with the specifications and explain each one plainly." },
  { id: "storytelling", label: "Storytelling", guidance: "Open with a short usage scenario, then cover the facts." },
  { id: "concise", label: "Concise", guidance: "Keep every section as short as the marketplace allows while staying complete." },
] as const;

export const LANGUAGES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "es-ES", label: "Spanish (Spain)" },
  { id: "es-MX", label: "Spanish (Latin America)" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "it-IT", label: "Italian" },
  { id: "pt-BR", label: "Portuguese (Brazil)" },
  { id: "nl-NL", label: "Dutch" },
  { id: "pl-PL", label: "Polish" },
  { id: "sv-SE", label: "Swedish" },
  { id: "tr-TR", label: "Turkish" },
  { id: "ar", label: "Arabic" },
  { id: "hi-IN", label: "Hindi" },
  { id: "bn-BD", label: "Bengali" },
  { id: "ja-JP", label: "Japanese" },
  { id: "ko-KR", label: "Korean" },
  { id: "zh-CN", label: "Chinese (Simplified)" },
] as const;

export type ToneId = (typeof TONES)[number]["id"];
export type StyleId = (typeof STYLES)[number]["id"];
export type LanguageId = (typeof LANGUAGES)[number]["id"];

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((x) => x.id) as unknown as [T[number]["id"], ...T[number]["id"][]];

const phraseList = z
  .array(z.string().trim().min(1).max(100))
  .max(50, "Up to 50 entries")
  .default([]);

export const MARKETPLACE_IDS = ["generic", "amazon", "shopify", "etsy", "ebay", "woocommerce"] as const;
export type MarketplaceId = (typeof MARKETPLACE_IDS)[number];

export const generationOptionsSchema = z.object({
  marketplace: z.enum(MARKETPLACE_IDS).default("generic"),
  language: z.enum(ids(LANGUAGES)).default("en-US"),
  tone: z.enum(ids(TONES)).default("professional"),
  style: z.enum(ids(STYLES)).default("benefit-led"),
  faqCount: z.number().int().min(0).max(8).default(4),
  prohibitedPhrases: phraseList,
  requiredKeywords: phraseList,
  brandVoiceNotes: z.string().trim().max(1000).default(""),
});

export type GenerationOptions = z.output<typeof generationOptionsSchema>;
export type GenerationOptionsInput = z.input<typeof generationOptionsSchema>;

export const DEFAULT_OPTIONS: GenerationOptions = generationOptionsSchema.parse({});

/** Splits a textarea value (comma or newline separated) into a clean list. */
export function splitList(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}
