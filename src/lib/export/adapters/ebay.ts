import type { ExportAdapter } from "../types";
import { listingToHtml } from "../format";

export const ebayAdapter: ExportAdapter = {
  id: "ebay",
  name: "eBay (listing fields)",
  description: "80-character title, HTML description and item specifics for eBay File Exchange or Seller Hub reports.",
  fileSlug: "ebay",
  constraints: {
    titleMaxLength: 80,
    bulletCount: 5,
    bulletMaxLength: 200,
    shortDescriptionMaxLength: 55,
    longDescriptionMaxLength: 4000,
    metaTitleMaxLength: 80,
    metaDescriptionMaxLength: 160,
    keywordLimit: 10,
  },
  promptGuidance:
    "Format for eBay: title is at most 80 characters, keyword-rich, no punctuation clutter, no words like 'L@@K' or 'wow'. The short description is an eBay subtitle of at most 55 characters. Include item condition only if stated in the data.",
  columns: ["CustomLabel", "Title", "Subtitle", "Description", "StartPrice", "Currency", "Brand", "UPC/EAN", "PicURL"],
  toRow({ fields, listing }) {
    return {
      CustomLabel: fields.sku ?? "",
      Title: listing.title,
      Subtitle: listing.shortDescription,
      Description: listingToHtml(listing, { includeBullets: true, includeFaqs: true }),
      StartPrice: fields.price ?? "",
      Currency: fields.currency ?? (fields.price ? "USD" : ""),
      Brand: fields.brand ?? "",
      "UPC/EAN": fields.gtin ?? "",
      PicURL: fields.imageUrl ?? "",
    };
  },
};
