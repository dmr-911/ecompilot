import type { ExportAdapter } from "../types";
import { plainText } from "../format";

const BULLETS = 5;

/**
 * Simplified Amazon inventory-loader layout. Amazon category templates add many
 * required attributes; paste these columns into your category's flat file.
 */
export const amazonAdapter: ExportAdapter = {
  id: "amazon",
  name: "Amazon (flat file columns)",
  description: "item_name, five bullet_point columns, product_description and generic_keywords for an Amazon category template.",
  fileSlug: "amazon",
  constraints: {
    titleMaxLength: 200,
    bulletCount: BULLETS,
    bulletMaxLength: 250,
    shortDescriptionMaxLength: 300,
    longDescriptionMaxLength: 2000,
    metaTitleMaxLength: 60,
    metaDescriptionMaxLength: 160,
    keywordLimit: 20,
  },
  promptGuidance:
    "Format for Amazon: title follows 'Brand + Product type + key attributes (size, color, quantity)'. No promotional words such as 'best', 'sale', 'free shipping'. No emojis or special symbols. Exactly five bullets, each starting with a short capitalised benefit phrase. The description is plain text without HTML. Keywords are lower-case search terms that do not repeat the brand or title words.",
  columns: [
    "item_sku",
    "item_name",
    "brand_name",
    "external_product_id",
    "external_product_id_type",
    "standard_price",
    "currency",
    "main_image_url",
    ...Array.from({ length: BULLETS }, (_, i) => `bullet_point${i + 1}`),
    "product_description",
    "generic_keywords",
  ],
  toRow({ fields, listing }) {
    const gtinType = fields.gtin ? (fields.gtin.length === 12 ? "UPC" : fields.gtin.length === 13 ? "EAN" : "GTIN") : "";
    const row: Record<string, string> = {
      item_sku: fields.sku ?? "",
      item_name: listing.title,
      brand_name: fields.brand ?? "",
      external_product_id: fields.gtin ?? "",
      external_product_id_type: gtinType,
      standard_price: fields.price ?? "",
      currency: fields.currency ?? (fields.price ? "USD" : ""),
      main_image_url: fields.imageUrl ?? "",
      product_description: plainText(listing),
      generic_keywords: listing.seo.keywords.join(" "),
    };
    for (let i = 0; i < BULLETS; i++) row[`bullet_point${i + 1}`] = listing.bullets[i] ?? "";
    return row;
  },
};
