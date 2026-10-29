import { z } from "zod";

/**
 * The structured output every provider must return. Kept to plain strings and
 * arrays so it works with every provider's JSON-schema mode. Length rules are
 * enforced afterwards by the quality checks, per marketplace.
 */
export const generatedListingSchema = z.object({
  title: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
  bullets: z.array(z.string()),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  seo: z.object({
    metaTitle: z.string(),
    metaDescription: z.string(),
    keywords: z.array(z.string()),
    urlSlug: z.string(),
  }),
  /** Facts a shopper would expect that the source data did not contain. */
  missingInformation: z.array(z.string()),
});

export type GeneratedListing = z.infer<typeof generatedListingSchema>;

/** Hand-written JSON Schema for providers that take one directly (OpenAI-compatible). */
export const generatedListingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "shortDescription", "longDescription", "bullets", "faqs", "seo", "missingInformation"],
  properties: {
    title: { type: "string" },
    shortDescription: { type: "string" },
    longDescription: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
    faqs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: { question: { type: "string" }, answer: { type: "string" } },
      },
    },
    seo: {
      type: "object",
      additionalProperties: false,
      required: ["metaTitle", "metaDescription", "keywords", "urlSlug"],
      properties: {
        metaTitle: { type: "string" },
        metaDescription: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        urlSlug: { type: "string" },
      },
    },
    missingInformation: { type: "array", items: { type: "string" } },
  },
} as const;
