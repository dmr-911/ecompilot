import { describe, expect, it } from "vitest";
import { containsPhrase, runQualityChecks } from "@/lib/quality/checks";
import { listing, options, WATER_BOTTLE } from "./helpers";

const codes = (flags: { code: string }[]) => flags.map((f) => f.code);

describe("quality checks", () => {
  it("passes a listing that only restates the source facts", () => {
    const flags = runQualityChecks(WATER_BOTTLE, listing(), options());
    expect(flags.filter((f) => f.severity !== "info")).toEqual([]);
  });

  it("flags invented certifications, warranties, free-from and superlative claims", () => {
    const flags = runQualityChecks(
      WATER_BOTTLE,
      listing({
        shortDescription: "FDA approved, BPA-free and the best bottle you can buy.",
        bullets: ["Backed by a lifetime warranty", "Certified food grade"],
      }),
      options(),
    );
    const claims = flags.filter((f) => f.code === "unsupported_claim");
    expect(claims.length).toBeGreaterThanOrEqual(4);
    expect(claims.every((f) => f.severity === "error")).toBe(true);
    expect(claims.map((c) => c.message).join(" ")).toMatch(/warranty/i);
  });

  it("does not flag a claim the source data supports", () => {
    const fields = { ...WATER_BOTTLE, specifications: `${WATER_BOTTLE.specifications}; Warranty: 2 years; BPA-free: yes` };
    const flags = runQualityChecks(fields, listing({ bullets: ["2 year warranty", "BPA-free"] }), options());
    expect(codes(flags)).not.toContain("unsupported_claim");
  });

  it("flags numbers that are not in the source data", () => {
    const flags = runQualityChecks(WATER_BOTTLE, listing({ shortDescription: "Holds 1000 ml and keeps drinks cold for 36 hours." }), options());
    const nums = flags.filter((f) => f.code === "unsupported_number").map((f) => f.message);
    expect(nums.join(" ")).toMatch(/1000/);
    expect(nums.join(" ")).toMatch(/36/);
    expect(nums.join(" ")).not.toMatch(/"750"/);
  });

  it("enforces prohibited phrases and required keywords", () => {
    const flags = runQualityChecks(
      WATER_BOTTLE,
      listing({ title: "Cheap Insulated Water Bottle" }),
      options({ prohibitedPhrases: ["cheap"], requiredKeywords: ["reusable", "water bottle"] }),
    );
    expect(flags).toContainEqual(expect.objectContaining({ code: "prohibited_phrase", severity: "error" }));
    const missing = flags.filter((f) => f.code === "required_keyword_missing");
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toMatch(/reusable/);
  });

  it("matches phrases on word boundaries, case-insensitively, in any script", () => {
    expect(containsPhrase("A Cheap mug", "cheap")).toBe(true);
    expect(containsPhrase("Cheapest mug", "cheap")).toBe(false);
    expect(containsPhrase("Taza   barata", "taza barata")).toBe(true);
    expect(containsPhrase("保温ボトル", "ボトル")).toBe(true);
  });

  it("checks lengths and counts against the marketplace profile", () => {
    const long = "x".repeat(81);
    const flags = runQualityChecks(WATER_BOTTLE, listing({ title: long, bullets: ["a"] }), options({ marketplace: "ebay" }));
    expect(flags).toContainEqual(expect.objectContaining({ code: "length_exceeded", field: "title" }));
    expect(flags).toContainEqual(expect.objectContaining({ code: "bullet_count" }));
    const etsy = runQualityChecks(WATER_BOTTLE, listing({ seo: { ...listing().seo, keywords: ["a very long etsy tag that is too long"] } }), options({ marketplace: "etsy" }));
    expect(etsy).toContainEqual(expect.objectContaining({ code: "keyword_limit" }));
  });

  it("reports missing information from the model and thin source data", () => {
    const flags = runQualityChecks({ name: "Mystery item" }, listing({ missingInformation: ["Dimensions"] }), options());
    expect(flags).toContainEqual(expect.objectContaining({ code: "missing_information", message: expect.stringMatching(/Dimensions/) }));
    expect(flags).toContainEqual(expect.objectContaining({ code: "thin_source_data" }));
  });

  it("flags an empty title as an error", () => {
    expect(runQualityChecks(WATER_BOTTLE, listing({ title: " " }), options())).toContainEqual(expect.objectContaining({ code: "empty_field", severity: "error" }));
  });
});
