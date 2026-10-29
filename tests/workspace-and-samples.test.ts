import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initialState, newWorkspace, reducer } from "@/lib/workspace/reducer";
import { parseCsv } from "@/lib/csv/parse";
import { suggestMapping } from "@/lib/csv/mapping";
import { SAMPLE_CSV } from "@/lib/demo/sample-products";
import { generateBatch } from "@/lib/generation/service";
import { createDemoProvider } from "@/lib/ai/providers/demo";
import { exportRecords } from "@/lib/export/registry";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts/templates";
import { LocalStorageRepository } from "@/lib/storage/local";
import { MemoryWorkspaceStore } from "@/lib/storage/server-store";
import { listing, options } from "./helpers";

const root = path.resolve(import.meta.dirname, "..");

function importedState() {
  const parsed = parseCsv(SAMPLE_CSV);
  let s = initialState(newWorkspace());
  s = reducer(s, { type: "importParsed", data: { ...parsed, fileName: "sample-products.csv", suggestedMapping: suggestMapping(parsed.headers) } });
  return reducer(s, { type: "applyMapping", mapping: suggestMapping(parsed.headers), mode: "replace" });
}

describe("sample data", () => {
  it("is identical in the app, examples/ and public/templates", () => {
    expect(readFileSync(path.join(root, "examples/products-input.csv"), "utf8")).toBe(SAMPLE_CSV);
    expect(readFileSync(path.join(root, "public/templates/sample-products.csv"), "utf8")).toBe(SAMPLE_CSV);
  });

  it("auto-maps every sample column", () => {
    const parsed = parseCsv(SAMPLE_CSV);
    const mapping = suggestMapping(parsed.headers);
    expect(Object.values(mapping).filter(Boolean)).toHaveLength(parsed.headers.length);
  });

  it("selects only valid, non-duplicate rows after import", () => {
    const s = importedState();
    expect(s.workspace.products).toHaveLength(11);
    expect(s.selection).toHaveLength(8);
    expect(s.workspace.name).toBe("sample-products");
    expect(s.step).toBe("products");
  });
});

describe("workspace reducer", () => {
  it("applies partial results and keeps failures retryable", () => {
    let s = importedState();
    const [a, b] = s.selection;
    s = reducer(s, { type: "markQueued", ids: [a, b] });
    s = reducer(s, {
      type: "applyResults",
      results: [
        { id: a, ok: true, listing: listing(), flags: [], usage: { inputTokens: 1, outputTokens: 1, model: "m" } },
        { id: b, ok: false, error: { kind: "rate_limited", message: "slow", retryable: true } },
      ],
    });
    const pa = s.workspace.products.find((p) => p.id === a)!;
    const pb = s.workspace.products.find((p) => p.id === b)!;
    expect(pa.status).toBe("done");
    expect(pb.status).toBe("error");
    expect(pb.error?.retryable).toBe(true);
  });

  it("re-runs quality checks on edits and when the marketplace changes", () => {
    let s = importedState();
    const id = s.selection[0];
    s = reducer(s, { type: "applyResults", results: [{ id, ok: true, listing: listing(), flags: [], usage: { inputTokens: 0, outputTokens: 0, model: "m" } }] });
    s = reducer(s, { type: "editListing", id, listing: listing({ title: "Lifetime warranty bottle" }) });
    expect(s.workspace.products.find((p) => p.id === id)!.flags.some((f) => f.code === "unsupported_claim")).toBe(true);
    s = reducer(s, { type: "editListing", id, listing: listing({ title: "Insulated Water Bottle ".repeat(5).trim() }) });
    const titleTooLong = () => s.workspace.products.find((x) => x.id === id)!.flags.some((f) => f.code === "length_exceeded" && f.field === "title");
    expect(titleTooLong()).toBe(false); // generic allows 150
    s = reducer(s, { type: "setOptions", options: options({ marketplace: "ebay" }) });
    expect(titleTooLong()).toBe(true); // eBay allows 80
    s = reducer(s, { type: "revertListing", id });
    expect(s.workspace.products.find((x) => x.id === id)!.edited).toBeUndefined();
  });

  it("re-validates and re-checks duplicates when a product is edited", () => {
    let s = importedState();
    const bad = s.workspace.products.find((p) => p.issues.some((i) => i.field === "price" && i.severity === "error"))!;
    s = reducer(s, { type: "updateFields", id: bad.id, fields: { ...bad.fields, price: "19.95" } });
    expect(s.workspace.products.find((p) => p.id === bad.id)!.issues.some((i) => i.severity === "error")).toBe(false);
    const dup = s.workspace.products.find((p) => p.duplicateOf)!;
    s = reducer(s, { type: "updateFields", id: dup.id, fields: { ...dup.fields, sku: "LP-9999" } });
    expect(s.workspace.products.find((p) => p.id === dup.id)!.duplicateOf).toBeUndefined();
  });

  it("only approves products that have a listing, and resets in-flight work on cancel", () => {
    let s = importedState();
    const ids = s.selection.slice(0, 2);
    s = reducer(s, { type: "approve", ids, approved: true });
    expect(s.workspace.products.filter((p) => p.approved)).toHaveLength(0);
    s = reducer(s, { type: "markGenerating", ids });
    s = reducer(s, { type: "resetInFlight" });
    expect(s.workspace.products.filter((p) => ids.includes(p.id)).every((p) => p.status === "idle")).toBe(true);
  });
});

describe("end-to-end with the demo provider", () => {
  it("imports the sample, generates, flags and exports every marketplace format", async () => {
    let s = importedState();
    const items = s.workspace.products.filter((p) => s.selection.includes(p.id)).map((p) => ({ id: p.id, fields: p.fields }));
    const results = await generateBatch(items, { provider: createDemoProvider({ delayMs: 0 }), model: "demo-template-v1", apiKey: "", options: s.workspace.options, concurrency: 3, maxOutputTokens: 1000 });
    s = reducer(s, { type: "applyResults", results });
    expect(results.every((r) => r.ok)).toBe(true);
    // The demo generator never invents claims.
    expect(results.flatMap((r) => (r.ok ? r.flags : [])).filter((f) => f.code === "unsupported_claim")).toEqual([]);
    s = reducer(s, { type: "approve", ids: s.selection, approved: true });
    for (const m of ["generic", "amazon", "shopify", "etsy", "ebay", "woocommerce"] as const) {
      const out = exportRecords(s.workspace.products, m, { onlyApproved: true });
      expect(out.exported, m).toBe(8);
    }
  });
});

describe("prompt templates", () => {
  it("states the accuracy rules, marketplace limits, language and the user's rules", () => {
    const sys = buildSystemPrompt(options({ marketplace: "etsy", language: "de-DE", tone: "luxury", prohibitedPhrases: ["cheap"], requiredKeywords: ["gift"] }));
    expect(sys).toMatch(/Do not state or imply certifications/);
    expect(sys).toMatch(/at most 140 characters/);
    expect(sys).toMatch(/German \(de-DE\)/);
    expect(sys).toMatch(/- cheap/);
    expect(sys).toMatch(/- gift/);
  });

  it("wraps product data in tags and leaves out the image URL", () => {
    const user = buildUserPrompt({ name: "Mug", imageUrl: "https://x.test/a.jpg", specifications: "Capacity: 350 ml" });
    expect(user).toMatch(/<product_data>\nProduct name: Mug\nSpecifications: Capacity: 350 ml\n<\/product_data>/);
    expect(user).not.toContain("x.test");
  });
});

describe("storage", () => {
  class MemStorage implements Storage {
    private m = new Map<string, string>();
    get length() {
      return this.m.size;
    }
    clear() {
      this.m.clear();
    }
    getItem(k: string) {
      return this.m.get(k) ?? null;
    }
    key(i: number) {
      return [...this.m.keys()][i] ?? null;
    }
    removeItem(k: string) {
      this.m.delete(k);
    }
    setItem(k: string, v: string) {
      this.m.set(k, v);
    }
  }

  it("saves, lists, loads and removes workspaces in browser storage", async () => {
    const repo = new LocalStorageRepository(new MemStorage());
    const ws = importedState().workspace;
    await repo.save(ws);
    expect((await repo.list())[0]).toMatchObject({ id: ws.id, productCount: 11 });
    expect((await repo.load(ws.id))?.products).toHaveLength(11);
    await repo.remove(ws.id);
    expect(await repo.list()).toEqual([]);
  });

  it("scopes server workspaces by owner", async () => {
    const store = new MemoryWorkspaceStore();
    const ws = newWorkspace();
    await store.put("owner-a", ws);
    expect(await store.get("owner-b", ws.id)).toBeNull();
    expect(await store.list("owner-a")).toHaveLength(1);
  });
});
