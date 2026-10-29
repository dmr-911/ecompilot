import type { ExportAdapter } from "../types";
import { escapeHtml, listingToHtml } from "../format";

/** Matches WooCommerce's built-in product CSV importer column names. */
export const woocommerceAdapter: ExportAdapter = {
  id: "woocommerce",
  name: "WooCommerce",
  description: "Columns for the WooCommerce product CSV importer, with HTML short and long descriptions.",
  fileSlug: "woocommerce",
  constraints: {
    titleMaxLength: 200,
    bulletCount: 5,
    bulletMaxLength: 200,
    shortDescriptionMaxLength: 400,
    longDescriptionMaxLength: 5000,
    metaTitleMaxLength: 60,
    metaDescriptionMaxLength: 160,
    keywordLimit: 15,
  },
  promptGuidance:
    "Format for a WooCommerce store: the short description appears next to the price, so make it a two-sentence summary. Keywords become product tags.",
  columns: ["Type", "SKU", "Name", "Published", "Short description", "Description", "Regular price", "Categories", "Tags", "Images"],
  toRow({ fields, listing }) {
    return {
      Type: "simple",
      SKU: fields.sku ?? "",
      Name: listing.title,
      Published: "0",
      "Short description": `<p>${escapeHtml(listing.shortDescription)}</p>`,
      Description: listingToHtml(listing, { includeBullets: true, includeFaqs: true }),
      "Regular price": fields.price ?? "",
      Categories: fields.category ?? "",
      Tags: listing.seo.keywords.join(", "),
      Images: fields.imageUrl ?? "",
    };
  },
};
