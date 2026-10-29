import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv/parse";
import { applyMapping, mappingProblems, suggestMapping } from "@/lib/csv/mapping";
import { buildRecords, validateFields } from "@/lib/csv/validate";
import { normalizePrice } from "@/lib/products/schema";

describe("column mapping", () => {
  it("suggests mappings from common header names", () => {
    const m = suggestMapping(["Item SKU", "Product Title", "Brand Name", "Regular Price", "Tech Specs", "Body (HTML)", "UPC", "Random"]);
    expect(m).toMatchObject({ sku: "Item SKU", name: "Product Title", brand: "Brand Name", price: "Regular Price", description: "Body (HTML)", gtin: "UPC" });
    expect(Object.values(m)).not.toContain("Random");
  });

  it("never maps one header to two fields", () => {
    const m = suggestMapping(["Title", "Name"]);
    const used = Object.values(m).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });

  it("reports a missing required field, unknown columns and double mappings", () => {
    expect(mappingProblems({}, ["A"])).toEqual([expect.stringMatching(/Product name/)]);
    expect(mappingProblems({ name: "Gone" }, ["A"])).toEqual([expect.stringMatching(/does not exist/)]);
    expect(mappingProblems({ name: "A", brand: "A" }, ["A"])).toEqual([expect.stringMatching(/more than one field/)]);
  });

  it("applies a mapping and drops blank values", () => {
    expect(applyMapping({ T: "Mug", B: " ", X: "y" }, { name: "T", brand: "B" })).toEqual({ name: "Mug" });
  });
});

describe("validation", () => {
  it("flags a missing name as an error", () => {
    const { issues } = validateFields({ sku: "A" });
    expect(issues).toContainEqual(expect.objectContaining({ field: "name", severity: "error" }));
  });

  it("normalises prices in several formats and rejects non-numbers", () => {
    expect(normalizePrice("$1,299.00")).toBe("1299.00");
    expect(normalizePrice("24,99 €")).toBe("24.99");
    expect(normalizePrice("1.299,50")).toBe("1299.50");
    expect(validateFields({ name: "Mug", price: "€24,99" }).fields.price).toBe("24.99");
    expect(validateFields({ name: "Mug", price: "abc" }).issues).toContainEqual(expect.objectContaining({ field: "price", severity: "error" }));
    expect(validateFields({ name: "Mug", price: "-5" }).issues).toContainEqual(expect.objectContaining({ field: "price", severity: "error" }));
  });

  it("validates currency, GTIN and image URL", () => {
    const bad = validateFields({ name: "Mug", currency: "dollars", gtin: "123", imageUrl: "javascript:alert(1)" });
    expect(bad.issues.map((i) => i.field)).toEqual(expect.arrayContaining(["currency", "gtin", "imageUrl"]));
    const ok = validateFields({ name: "Mug", currency: "eur", gtin: "0123-4567-8905", imageUrl: "https://x.test/a.jpg" });
    expect(ok.fields).toMatchObject({ currency: "EUR", gtin: "012345678905" });
    expect(ok.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("warns when there is no source data to write from", () => {
    expect(validateFields({ name: "Mug", sku: "1" }).issues).toContainEqual(expect.objectContaining({ severity: "warning", message: expect.stringMatching(/No specifications/) }));
  });
});

describe("duplicate detection", () => {
  const csv = [
    "SKU,Name,Brand,Size",
    "A1,Bottle,North,750 ml",
    "a1 ,Bottle copy,North,750 ml",
    ",Mug,Kettle,",
    ",  MUG!! ,Kettle,",
    ",Mug,Kettle,Large",
    "B2,Bottle,North,750 ml",
  ].join("\n");

  it("marks repeated SKUs (case/space insensitive) and repeated name+brand+variant without SKU", () => {
    const parsed = parseCsv(csv);
    const { records, summary } = buildRecords(parsed, suggestMapping(parsed.headers));
    const dup = (row: number) => records.find((r) => r.sourceRow === row)!;
    expect(dup(3).duplicateOf).toBe(dup(2).id);
    expect(dup(5).duplicateOf).toBe(dup(4).id);
    expect(dup(6).duplicateOf).toBeUndefined(); // different size is a different variant
    expect(dup(7).duplicateOf).toBeUndefined(); // distinct SKU wins over same name
    expect(summary.duplicates).toBe(2);
  });

  it("attaches parse issues to the right rows", () => {
    const parsed = parseCsv("Name,Price\nMug,1,2\nCup,3\n");
    const { records } = buildRecords(parsed, { name: "Name", price: "Price" });
    expect(records[0].issues.some((i) => i.severity === "error")).toBe(true);
    expect(records[1].issues.some((i) => i.severity === "error")).toBe(false);
  });
});
