import type { ProductFields } from "../products/fields";
import type { ProductRecord } from "../products/types";
import type { GeneratedListing } from "../prompts/output-schema";
import type { ColumnMapping } from "../csv/mapping";
import type { ParsedCsv } from "../csv/parse";
import type { GenerationItemResult } from "../generation/service";
import type { GenerationOptions } from "../generation/options";
import { DEFAULT_OPTIONS } from "../generation/options";
import { buildRecords, markDuplicates, newId, validateFields } from "../csv/validate";
import { runQualityChecks } from "../quality/checks";
import type { ProviderId } from "../ai/types";
import type { Workspace } from "../storage/types";

export type StepId = "import" | "map" | "products" | "generate" | "review" | "export";

export interface ImportState extends ParsedCsv {
  fileName?: string;
  suggestedMapping: ColumnMapping;
}

export interface WorkspaceState {
  workspace: Workspace;
  pendingImport?: ImportState;
  selection: string[];
  step: StepId;
}

export type Action =
  | { type: "load"; workspace: Workspace; step?: StepId }
  | { type: "reset"; workspace: Workspace }
  | { type: "goto"; step: StepId }
  | { type: "rename"; name: string }
  | { type: "importParsed"; data: ImportState }
  | { type: "applyMapping"; mapping: ColumnMapping; mode: "replace" | "append" }
  | { type: "updateFields"; id: string; fields: ProductFields }
  | { type: "addProduct"; fields: ProductFields }
  | { type: "deleteProducts"; ids: string[] }
  | { type: "select"; ids: string[] }
  | { type: "setOptions"; options: GenerationOptions }
  | { type: "setProvider"; provider: ProviderId; model: string }
  | { type: "markQueued"; ids: string[] }
  | { type: "markGenerating"; ids: string[] }
  | { type: "applyResults"; results: GenerationItemResult[] }
  | { type: "markFailed"; ids: string[]; kind: NonNullable<ProductRecord["error"]>["kind"]; message: string; retryable: boolean }
  | { type: "resetInFlight" }
  | { type: "editListing"; id: string; listing: GeneratedListing }
  | { type: "revertListing"; id: string }
  | { type: "approve"; ids: string[]; approved: boolean };

export function newWorkspace(partial: Partial<Workspace> = {}): Workspace {
  const now = Date.now();
  return {
    id: `ws_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: "Untitled workspace",
    createdAt: now,
    updatedAt: now,
    headers: [],
    mapping: {},
    products: [],
    options: DEFAULT_OPTIONS,
    provider: "demo",
    model: "",
    isDemo: false,
    ...partial,
  };
}

export function initialState(workspace = newWorkspace()): WorkspaceState {
  return { workspace, selection: [], step: workspace.products.length ? "products" : "import" };
}

function touch(state: WorkspaceState, patch: Partial<Workspace>): WorkspaceState {
  return { ...state, workspace: { ...state.workspace, ...patch, updatedAt: Date.now() } };
}

function mapProducts(state: WorkspaceState, ids: Set<string>, fn: (p: ProductRecord) => ProductRecord): WorkspaceState {
  return touch(state, { products: state.workspace.products.map((p) => (ids.has(p.id) ? fn(p) : p)) });
}

function recheck(p: ProductRecord, options: GenerationOptions): ProductRecord {
  const listing = p.edited ?? p.generated;
  return listing ? { ...p, flags: runQualityChecks(p.fields, listing, options) } : p;
}

export function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "load":
      return { workspace: action.workspace, selection: [], step: action.step ?? (action.workspace.products.length ? "products" : "import") };
    case "reset":
      return initialState(action.workspace);
    case "goto":
      return { ...state, step: action.step };
    case "rename":
      return touch(state, { name: action.name.slice(0, 120) || "Untitled workspace" });
    case "importParsed":
      return { ...state, pendingImport: action.data, step: "map" };
    case "applyMapping": {
      const pending = state.pendingImport;
      if (!pending) return state;
      const built = buildRecords(pending, action.mapping);
      const products = action.mode === "append" ? markDuplicates([...state.workspace.products, ...built.records]) : built.records;
      const next = touch(state, {
        products,
        headers: pending.headers,
        mapping: action.mapping,
        fileName: pending.fileName,
        name: state.workspace.name === "Untitled workspace" && pending.fileName ? pending.fileName.replace(/\.[^.]+$/, "") : state.workspace.name,
      });
      return { ...next, pendingImport: undefined, selection: built.records.filter((r) => !r.issues.some((i) => i.severity === "error") && !r.duplicateOf).map((r) => r.id), step: "products" };
    }
    case "updateFields": {
      const updated = mapProducts(state, new Set([action.id]), (p) => {
        const { fields, issues } = validateFields(action.fields);
        return recheck({ ...p, fields, issues, updatedAt: Date.now() }, state.workspace.options);
      });
      return touch(updated, { products: markDuplicates(updated.workspace.products) });
    }
    case "addProduct": {
      const { fields, issues } = validateFields(action.fields);
      const record: ProductRecord = {
        id: newId(),
        sourceRow: 0,
        fields,
        issues,
        status: "idle",
        flags: [],
        approved: false,
        updatedAt: Date.now(),
      };
      return touch(state, { products: markDuplicates([...state.workspace.products, record]) });
    }
    case "deleteProducts": {
      const ids = new Set(action.ids);
      const next = touch(state, { products: markDuplicates(state.workspace.products.filter((p) => !ids.has(p.id))) });
      return { ...next, selection: state.selection.filter((id) => !ids.has(id)) };
    }
    case "select":
      return { ...state, selection: Array.from(new Set(action.ids)) };
    case "setOptions": {
      const next = touch(state, { options: action.options });
      return touch(next, { products: next.workspace.products.map((p) => recheck(p, action.options)) });
    }
    case "setProvider":
      return touch(state, { provider: action.provider, model: action.model });
    case "markQueued":
      return mapProducts(state, new Set(action.ids), (p) => ({ ...p, status: "queued", error: undefined }));
    case "markGenerating":
      return mapProducts(state, new Set(action.ids), (p) => ({ ...p, status: "generating" }));
    case "applyResults": {
      const byId = new Map(action.results.map((r) => [r.id, r]));
      return touch(state, {
        products: state.workspace.products.map((p) => {
          const r = byId.get(p.id);
          if (!r) return p;
          if (r.ok) {
            return {
              ...p,
              status: "done",
              error: undefined,
              generated: r.listing,
              edited: undefined,
              flags: r.flags,
              usage: r.usage,
              approved: false,
              updatedAt: Date.now(),
            };
          }
          return { ...p, status: "error", error: { kind: r.error.kind, message: r.error.message, retryable: r.error.retryable }, updatedAt: Date.now() };
        }),
      });
    }
    case "markFailed":
      return mapProducts(state, new Set(action.ids), (p) => ({ ...p, status: "error", error: { kind: action.kind, message: action.message, retryable: action.retryable } }));
    case "resetInFlight":
      return touch(state, {
        products: state.workspace.products.map((p) =>
          p.status === "queued" || p.status === "generating" ? { ...p, status: p.generated ? "done" : "idle" } : p,
        ),
      });
    case "editListing":
      return mapProducts(state, new Set([action.id]), (p) =>
        recheck({ ...p, edited: action.listing, updatedAt: Date.now() }, state.workspace.options),
      );
    case "revertListing":
      return mapProducts(state, new Set([action.id]), (p) => recheck({ ...p, edited: undefined }, state.workspace.options));
    case "approve":
      return mapProducts(state, new Set(action.ids), (p) => (p.generated || p.edited ? { ...p, approved: action.approved } : p));
    default:
      return state;
  }
}
