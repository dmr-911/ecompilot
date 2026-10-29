import type { ExportAdapter } from "../types";

const BULLETS = 5;

export const genericAdapter: ExportAdapter = {
  id: "generic",
  name: "Generic (all fields)",
  description: "Every generated field in its own column, plus your original data. Best for agencies and custom imports.",
  fileSlug: "generic",
  constraints: {
    titleMaxLength: 150,
    bulletCount: BULLETS,
    bulletMaxLength: 250,
    shortDescriptionMaxLength: 300,
    longDescriptionMaxLength: 5000,
    metaTitleMaxLength: 60,
    metaDescriptionMaxLength: 160,
    keywordLimit: 15,
  },
  promptGuidance: "Write for a standalone online store product page.",
  columns: [
    "sku",
    "original_name",
    "brand",
    "category",
    "price",
    "currency",
    "gtin",
    "image_url",
    "title",
    "short_description",
    "long_description",
    ...Array.from({ length: BULLETS }, (_, i) => `bullet_${i + 1}`),
    "faqs_json",
    "meta_title",
    "meta_description",
    "seo_keywords",
    "url_slug",
    "missing_information",
  ],
  toRow({ fields, listing }) {
    const row: Record<string, string> = {
      sku: fields.sku ?? "",
      original_name: fields.name ?? "",
      brand: fields.brand ?? "",
      category: fields.category ?? "",
      price: fields.price ?? "",
      currency: fields.currency ?? (fields.price ? "USD" : ""),
      gtin: fields.gtin ?? "",
      image_url: fields.imageUrl ?? "",
      title: listing.title,
      short_description: listing.shortDescription,
      long_description: listing.longDescription,
      faqs_json: JSON.stringify(listing.faqs),
      meta_title: listing.seo.metaTitle,
      meta_description: listing.seo.metaDescription,
      seo_keywords: listing.seo.keywords.join(", "),
      url_slug: listing.seo.urlSlug,
      missing_information: listing.missingInformation.join("; "),
    };
    for (let i = 0; i < BULLETS; i++) row[`bullet_${i + 1}`] = listing.bullets[i] ?? "";
    return row;
  },
};
