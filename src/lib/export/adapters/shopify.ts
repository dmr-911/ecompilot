import type { ExportAdapter } from "../types";
import { listingToHtml, slugify } from "../format";

/** Matches the column names of Shopify's product CSV import template. */
export const shopifyAdapter: ExportAdapter = {
  id: "shopify",
  name: "Shopify (product CSV)",
  description: "Shopify product import columns with HTML body, tags, and SEO title/description.",
  fileSlug: "shopify",
  constraints: {
    titleMaxLength: 255,
    bulletCount: 5,
    bulletMaxLength: 200,
    shortDescriptionMaxLength: 300,
    longDescriptionMaxLength: 5000,
    metaTitleMaxLength: 70,
    metaDescriptionMaxLength: 160,
    keywordLimit: 15,
  },
  promptGuidance:
    "Format for a Shopify store: concise scannable title without the store name. Long description in two to four short paragraphs. Keywords become store tags, so keep them to one to three words each.",
  columns: [
    "Handle",
    "Title",
    "Body (HTML)",
    "Vendor",
    "Product Category",
    "Type",
    "Tags",
    "Published",
    "Variant SKU",
    "Variant Price",
    "Variant Barcode",
    "Image Src",
    "SEO Title",
    "SEO Description",
  ],
  toRow({ fields, listing }) {
    return {
      Handle: slugify(listing.seo.urlSlug || listing.title),
      Title: listing.title,
      "Body (HTML)": listingToHtml(listing, { includeBullets: true, includeFaqs: true }),
      Vendor: fields.brand ?? "",
      "Product Category": "",
      Type: fields.category ?? "",
      Tags: listing.seo.keywords.slice(0, 15).join(", "),
      Published: "FALSE",
      "Variant SKU": fields.sku ?? "",
      "Variant Price": fields.price ?? "",
      "Variant Barcode": fields.gtin ?? "",
      "Image Src": fields.imageUrl ?? "",
      "SEO Title": listing.seo.metaTitle,
      "SEO Description": listing.seo.metaDescription,
    };
  },
};
