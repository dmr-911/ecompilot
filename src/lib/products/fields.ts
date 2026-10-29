/**
 * Standard product fields that imported CSV columns are mapped onto.
 * Every other module (validation, prompting, export) works against these keys,
 * never against the customer's original column names.
 */
export const PRODUCT_FIELD_KEYS = [
  "sku",
  "name",
  "brand",
  "category",
  "price",
  "currency",
  "specifications",
  "description",
  "features",
  "materials",
  "dimensions",
  "weight",
  "color",
  "size",
  "gtin",
  "imageUrl",
  "keywords",
] as const;

export type ProductFieldKey = (typeof PRODUCT_FIELD_KEYS)[number];

export interface ProductFieldDefinition {
  key: ProductFieldKey;
  label: string;
  help: string;
  required: boolean;
  /** Lower-cased header names that auto-map to this field. */
  synonyms: string[];
}

export const PRODUCT_FIELDS: readonly ProductFieldDefinition[] = [
  {
    key: "sku",
    label: "SKU",
    help: "Unique product identifier. Used for duplicate detection and export.",
    required: false,
    synonyms: ["sku", "item sku", "item_sku", "product id", "product_id", "id", "variant sku", "custom label", "article number", "mpn", "part number"],
  },
  {
    key: "name",
    label: "Product name",
    help: "The product's current name or working title.",
    required: true,
    synonyms: ["name", "product name", "product_name", "title", "product title", "item name", "item_name"],
  },
  {
    key: "brand",
    label: "Brand",
    help: "Brand or manufacturer.",
    required: false,
    synonyms: ["brand", "brand name", "brand_name", "manufacturer", "vendor", "maker"],
  },
  {
    key: "category",
    label: "Category",
    help: "Product category or type.",
    required: false,
    synonyms: ["category", "categories", "product type", "type", "product category", "department"],
  },
  {
    key: "price",
    label: "Price",
    help: "Numeric price, e.g. 24.99. Currency symbols and thousands separators are stripped.",
    required: false,
    synonyms: ["price", "regular price", "list price", "standard_price", "retail price", "msrp", "variant price", "start price"],
  },
  {
    key: "currency",
    label: "Currency",
    help: "ISO 4217 code such as USD, EUR, GBP.",
    required: false,
    synonyms: ["currency", "currency code", "currency_code"],
  },
  {
    key: "specifications",
    label: "Specifications",
    help: "Facts about the product. Use 'Key: Value' pairs separated by ';' or new lines.",
    required: false,
    synonyms: ["specifications", "specs", "spec", "technical specifications", "attributes", "details", "product details"],
  },
  {
    key: "description",
    label: "Existing description",
    help: "Any current description. Used as source material only.",
    required: false,
    synonyms: ["description", "existing description", "product description", "body", "body (html)", "long description", "short description"],
  },
  {
    key: "features",
    label: "Existing features",
    help: "Existing bullet points, separated by '|' or new lines.",
    required: false,
    synonyms: ["features", "feature bullets", "bullets", "bullet points", "key features", "highlights"],
  },
  {
    key: "materials",
    label: "Materials / ingredients",
    help: "Materials or ingredients exactly as they should be stated.",
    required: false,
    synonyms: ["materials", "material", "ingredients", "composition", "fabric"],
  },
  {
    key: "dimensions",
    label: "Dimensions",
    help: "Size measurements, e.g. 30 x 20 x 10 cm.",
    required: false,
    synonyms: ["dimensions", "dimension", "measurements", "product dimensions"],
  },
  {
    key: "weight",
    label: "Weight",
    help: "Product weight including units.",
    required: false,
    synonyms: ["weight", "item weight", "net weight", "shipping weight"],
  },
  {
    key: "color",
    label: "Color",
    help: "Color or finish.",
    required: false,
    synonyms: ["color", "colour", "finish"],
  },
  {
    key: "size",
    label: "Size",
    help: "Size, capacity, or volume.",
    required: false,
    synonyms: ["size", "capacity", "volume"],
  },
  {
    key: "gtin",
    label: "GTIN / UPC / EAN",
    help: "Barcode number (8, 12, 13, or 14 digits).",
    required: false,
    synonyms: ["gtin", "upc", "ean", "barcode", "isbn", "variant barcode", "external_product_id"],
  },
  {
    key: "imageUrl",
    label: "Image URL",
    help: "Main image URL. Passed through to export; not sent to the AI provider.",
    required: false,
    synonyms: ["image", "image url", "image_url", "image src", "main image", "images", "photo"],
  },
  {
    key: "keywords",
    label: "Seed keywords",
    help: "Keywords the customer wants considered, separated by ',' or ';'.",
    required: false,
    synonyms: ["keywords", "tags", "search terms", "generic_keywords", "seo keywords"],
  },
];

export const FIELD_BY_KEY: Record<ProductFieldKey, ProductFieldDefinition> = Object.fromEntries(
  PRODUCT_FIELDS.map((f) => [f.key, f]),
) as Record<ProductFieldKey, ProductFieldDefinition>;

export type ProductFields = Partial<Record<ProductFieldKey, string>>;
