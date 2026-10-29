import { z } from "zod";
import { PRODUCT_FIELD_KEYS, type ProductFieldKey } from "./fields";

const MAX_FIELD_LENGTH = 5000;

const optionalText = (max = MAX_FIELD_LENGTH) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

/** Parses "1,299.00", "$24.99", "24,99 €" style inputs into a plain decimal string. */
export function normalizePrice(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  let cleaned = trimmed.replace(/[^\d.,-]/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned) || /^-?\d+,\d{1,2}$/.test(cleaned)) {
    // European format: 1.299,00 or 24,99
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  return cleaned;
}

export const priceSchema = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    const normalized = normalizePrice(v);
    if (normalized === undefined) return undefined;
    const n = Number(normalized);
    if (!Number.isFinite(n) || normalized === "" || normalized === "-") {
      ctx.addIssue({ code: "custom", message: "Price must be a number, e.g. 24.99" });
      return z.NEVER;
    }
    if (n < 0) {
      ctx.addIssue({ code: "custom", message: "Price cannot be negative" });
      return z.NEVER;
    }
    return n.toFixed(2);
  });

export const currencySchema = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const upper = v.toUpperCase();
    if (!/^[A-Z]{3}$/.test(upper)) {
      ctx.addIssue({ code: "custom", message: "Currency must be a 3-letter ISO code such as USD" });
      return z.NEVER;
    }
    return upper;
  });

export const gtinSchema = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const digits = v.replace(/[\s-]/g, "");
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits)) {
      ctx.addIssue({ code: "custom", message: "GTIN must be 8, 12, 13, or 14 digits" });
      return z.NEVER;
    }
    return digits;
  });

export const imageUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    try {
      const url = new URL(v);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
      return v;
    } catch {
      ctx.addIssue({ code: "custom", message: "Image URL must be an http(s) URL" });
      return z.NEVER;
    }
  });

/**
 * Canonical validated product fields. Used for imported rows, the edit form,
 * and server-side request validation.
 */
export const productFieldsSchema = z.object({
  sku: optionalText(100),
  name: z
    .string({ error: "Product name is required" })
    .trim()
    .min(1, "Product name is required")
    .max(300, "Product name must be 300 characters or fewer"),
  brand: optionalText(150),
  category: optionalText(300),
  price: priceSchema,
  currency: currencySchema,
  specifications: optionalText(),
  description: optionalText(),
  features: optionalText(),
  materials: optionalText(1000),
  dimensions: optionalText(300),
  weight: optionalText(100),
  color: optionalText(100),
  size: optionalText(100),
  gtin: gtinSchema,
  imageUrl: imageUrlSchema,
  keywords: optionalText(1000),
});

export type ValidProductFields = z.output<typeof productFieldsSchema>;

/** Same shape but every field is a raw string; handy for form default values. */
export type ProductFormValues = Record<ProductFieldKey, string>;

export function emptyFormValues(): ProductFormValues {
  return Object.fromEntries(PRODUCT_FIELD_KEYS.map((k) => [k, ""])) as ProductFormValues;
}
