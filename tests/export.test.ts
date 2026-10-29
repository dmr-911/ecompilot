import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { sanitizeCell, toCsv } from "@/lib/csv/serialize";
import { EXPORT_ADAPTERS, exportRecords } from "@/lib/export/registry";
import { listingToHtml } from "@/lib/export/format";
import type { ProductRecord } from "@/lib/products/types";
import { listing, WATER_BOTTLE } from "./helpers";

function record(over: Partial<ProductRecord> = {}): ProductRecord {
  return { id: "p1", sourceRow: 2, fields: { ...WATER_BOTTLE, price: "24.99", gtin: "012345678905" }, issues: [], status: "done", flags: [], approved: true, updatedAt: 0, generated: listing(), ...over };
}

function parse(csv: string) {
  return Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
}

describe("CSV serialisation", () => {
  it("quotes commas, quotes and newlines so the file round-trips", () => {
    const csv = toCsv(["a", "b"], [{ a: 'He said "hi", twice', b: "line1\nline2" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(parse(csv).data[0]).toEqual({ a: 'He said "hi", twice', b: "line1\nline2" });
  });

  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(sanitizeCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(sanitizeCell("+1 555")).toBe("'+1 555");
    expect(sanitizeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeCell("-12.5")).toBe("-12.5");
    expect(sanitizeCell(undefined)).toBe("");
  });
});

describe("export adapters", () => {
  it("every adapter emits exactly its declared columns", () => {
    for (const adapter of Object.values(EXPORT_ADAPTERS)) {
      const row = adapter.toRow({ fields: record().fields, listing: listing() });
      expect(Object.keys(row).sort(), adapter.id).toEqual([...adapter.columns].sort());
      const parsed = parse(toCsv(adapter.columns, [row]));
      expect(parsed.meta.fields).toEqual(adapter.columns);
      expect(parsed.errors).toEqual([]);
    }
  });

  it("maps fields to the expected marketplace columns", () => {
    const amazon = EXPORT_ADAPTERS.amazon.toRow({ fields: record().fields, listing: listing() });
    expect(amazon).toMatchObject({ item_sku: "LP-1001", item_name: listing().title, external_product_id_type: "UPC", standard_price: "24.99", bullet_point5: "18/8 stainless steel" });
    const shopify = EXPORT_ADAPTERS.shopify.toRow({ fields: record().fields, listing: listing() });
    expect(shopify).toMatchObject({ Handle: "insulated-water-bottle", "Variant SKU": "LP-1001", Published: "FALSE", "SEO Title": listing().seo.metaTitle });
  });

  it("escapes model output when building HTML descriptions", () => {
    const html = listingToHtml(listing({ longDescription: "<script>alert(1)</script>\n\nSecond & last", bullets: ['<img src=x onerror="y">'] }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<p>Second &amp; last</p>");
    expect(html).toContain("&lt;img src=x onerror=&quot;y&quot;&gt;");
  });

  it("limits Etsy tags to 13 of at most 20 characters", () => {
    const keywords = Array.from({ length: 16 }, (_, i) => `tag${i}`).concat("this tag is far too long for etsy");
    const row = EXPORT_ADAPTERS.etsy.toRow({ fields: record().fields, listing: listing({ seo: { ...listing().seo, keywords } }) });
    const tags = row.Tags.split(",");
    expect(tags).toHaveLength(13);
    expect(tags.every((t) => t.length <= 20)).toBe(true);
  });

  it("exports edited versions, skips unapproved and ungenerated products", () => {
    const edited = record({ id: "e", edited: listing({ title: "Edited title" }) });
    const unapproved = record({ id: "u", approved: false });
    const none = record({ id: "n", generated: undefined });
    const res = exportRecords([edited, unapproved, none], "generic", { onlyApproved: true, date: new Date("2026-10-29") });
    expect(res.exported).toBe(1);
    expect(res.skipped.map((s) => s.id).sort()).toEqual(["n", "u"]);
    expect(res.fileName).toBe("listingpilot-generic-2026-10-29.csv");
    expect(parse(res.csv).data[0].title).toBe("Edited title");
    expect(JSON.parse(parse(res.csv).data[0].faqs_json)).toEqual(listing().faqs);
  });

  it("defaults currency to USD only when a price exists", () => {
    const withPrice = EXPORT_ADAPTERS.generic.toRow({ fields: { name: "a", price: "1.00" }, listing: listing() });
    const without = EXPORT_ADAPTERS.generic.toRow({ fields: { name: "a" }, listing: listing() });
    expect(withPrice.currency).toBe("USD");
    expect(without.currency).toBe("");
  });
});
