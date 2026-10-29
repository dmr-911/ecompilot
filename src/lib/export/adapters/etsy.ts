import type { ExportAdapter } from "../types";
import { plainText } from "../format";

export const etsyAdapter: ExportAdapter = {
  id: "etsy",
  name: "Etsy",
  description: "Title, plain-text description, 13 tags (20 characters max each), price and SKU.",
  fileSlug: "etsy",
  constraints: {
    titleMaxLength: 140,
    bulletCount: 5,
    bulletMaxLength: 200,
    shortDescriptionMaxLength: 300,
    longDescriptionMaxLength: 5000,
    metaTitleMaxLength: 60,
    metaDescriptionMaxLength: 160,
    keywordLimit: 13,
    keywordMaxLength: 20,
  },
  promptGuidance:
    "Format for Etsy: title up to 140 characters, front-load the most searched words. Description is plain text, starting with one or two sentences that summarise the item; include bullets as lines starting with '• '. Exactly 13 keywords, each 20 characters or fewer, as shoppers would search.",
  columns: ["SKU", "Title", "Description", "Price", "Currency", "Tags", "Materials"],
  toRow({ fields, listing }) {
    const bullets = listing.bullets.map((b) => `• ${b}`).join("\n");
    return {
      SKU: fields.sku ?? "",
      Title: listing.title,
      Description: [plainText(listing, { includeFaqs: true }), bullets].filter(Boolean).join("\n\n"),
      Price: fields.price ?? "",
      Currency: fields.currency ?? (fields.price ? "USD" : ""),
      Tags: listing.seo.keywords
        .filter((k) => k.length <= 20)
        .slice(0, 13)
        .join(","),
      Materials: fields.materials ?? "",
    };
  },
};
