import { describe, expect, it } from "vitest";
import { CsvError, parseCsv } from "@/lib/csv/parse";

describe("parseCsv", () => {
  it("parses headers and rows with row numbers", () => {
    const r = parseCsv("SKU,Name\nA1,Bottle\nA2,Mug\n");
    expect(r.headers).toEqual(["SKU", "Name"]);
    expect(r.rows).toEqual([
      { SKU: "A1", Name: "Bottle" },
      { SKU: "A2", Name: "Mug" },
    ]);
    expect(r.rowNumbers).toEqual([2, 3]);
    expect(r.issues).toEqual([]);
  });

  it("handles quoted commas, newlines, escaped quotes and a UTF-8 BOM", () => {
    const r = parseCsv('﻿Name,Specs\n"Bottle, large","Line 1\nLine 2 ""quoted"""\n');
    expect(r.headers[0]).toBe("Name");
    expect(r.rows[0]).toEqual({ Name: "Bottle, large", Specs: 'Line 1\nLine 2 "quoted"' });
  });

  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("Name;Price\nMug;4,50\n").rows[0]).toEqual({ Name: "Mug", Price: "4,50" });
    expect(parseCsv("Name\tPrice\nMug\t4.50\n").rows[0]).toEqual({ Name: "Mug", Price: "4.50" });
  });

  it("rejects empty, header-only and binary files", () => {
    expect(() => parseCsv("")).toThrow(CsvError);
    expect(() => parseCsv("   \n  ")).toThrow(/empty/);
    expect(() => parseCsv("Name,Price\n")).toThrow(/no product rows/);
    expect(() => parseCsv("PK\u0003\u0004\u0000\u0000binary")).toThrow(/binary/);
  });

  it("reports rows with too many values as errors and too few as warnings", () => {
    const r = parseCsv("Name,Price\nMug,4.50,extra\nCup\n");
    expect(r.issues).toContainEqual(expect.objectContaining({ row: 2, severity: "error" }));
    expect(r.issues).toContainEqual(expect.objectContaining({ row: 3, severity: "warning" }));
    expect(r.rows[1]).toEqual({ Name: "Cup", Price: "" });
  });

  it("reports an unclosed quote as malformed", () => {
    const r = parseCsv('Name,Price\n"Mug,4.50\nCup,3\n');
    expect(r.issues.some((i) => i.severity === "error" && /Malformed/.test(i.message))).toBe(true);
  });

  it("renames duplicate and blank headers so every column can be mapped", () => {
    const r = parseCsv("Name,Name,\nA,B,C\n");
    expect(r.headers).toEqual(["Name", "Name (2)", "Column 3"]);
    expect(r.issues.filter((i) => i.row === 1)).toHaveLength(2);
  });

  it("enforces row and column limits", () => {
    const rows = Array.from({ length: 6 }, (_, i) => `P${i}`).join("\n");
    expect(() => parseCsv(`Name\n${rows}`, { maxRows: 5 })).toThrow(/limit is 5/);
    expect(() => parseCsv("a,b,c\n1,2,3", { maxColumns: 2 })).toThrow(/limit is 2/);
  });

  it("truncates over-long cells with a warning", () => {
    const r = parseCsv(`Name\n${"x".repeat(50)}`, { maxCellLength: 10 });
    expect(r.rows[0].Name).toHaveLength(10);
    expect(r.issues[0].severity).toBe("warning");
  });
});
