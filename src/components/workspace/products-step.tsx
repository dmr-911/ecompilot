"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, CardHeader, Input, Select } from "@/components/ui";
import { useWorkspace } from "./context";
import { FILTERS, matchesFilter, matchesSearch, type FilterId } from "./filters";
import { FlagBadge, IssueBadge, StatusBadge } from "./status";
import { Drawer } from "./drawer";
import { ProductEditor } from "./product-editor";
import type { ProductRecord } from "@/lib/products/types";

const PAGE = 50;

export function ProductsStep() {
  const { state, dispatch, isRunning } = useWorkspace();
  const products = state.workspace.products;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ProductRecord | "new" | null>(null);

  const filtered = useMemo(() => products.filter((p) => matchesFilter(p, filter) && matchesSearch(p, query)), [products, filter, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const selected = new Set(state.selection);
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const setSelection = (ids: string[]) => dispatch({ type: "select", ids });
  const toggle = (id: string) => setSelection(selected.has(id) ? state.selection.filter((x) => x !== id) : [...state.selection, id]);
  const selectedWithErrors = products.filter((p) => selected.has(p.id) && p.issues.some((i) => i.severity === "error")).length;

  if (products.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-600">No products yet.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => dispatch({ type: "goto", step: "import" })}>Import a CSV</Button>
          <Button variant="secondary" onClick={() => setEditing("new")}>
            Add a product manually
          </Button>
        </div>
        <Drawer open={editing === "new"} title="Add product" onClose={() => setEditing(null)}>
          <ProductEditor initial={{}} submitLabel="Add product" onCancel={() => setEditing(null)} onSave={(fields) => { dispatch({ type: "addProduct", fields }); setEditing(null); }} />
        </Drawer>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Products"
        description="Review and fix imported data, then select the products to generate. Click a row to edit it."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
              Add product
            </Button>
            <Button size="sm" disabled={state.selection.length === 0} onClick={() => dispatch({ type: "goto", step: "generate" })}>
              Generate {state.selection.length || ""} selected
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <Input
          type="search"
          placeholder="Search name, SKU, brand, category…"
          aria-label="Search products"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className="sm:max-w-xs"
        />
        <Select
          aria-label="Filter products"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as FilterId);
            setPage(0);
          }}
          className="sm:max-w-48"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} ({products.filter((p) => matchesFilter(p, f.id)).length})
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-2 text-sm sm:ml-auto">
          <span className="text-slate-600">{state.selection.length} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setSelection(products.filter((p) => matchesFilter(p, "valid")).map((p) => p.id))}>
            Select all valid
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection([])} disabled={!state.selection.length}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={!state.selection.length || isRunning}
            onClick={() => {
              if (window.confirm(`Remove ${state.selection.length} product(s) from this workspace?`)) dispatch({ type: "deleteProducts", ids: state.selection });
            }}
          >
            Remove
          </Button>
        </div>
      </div>
      {selectedWithErrors > 0 ? (
        <div className="px-4 pt-3 sm:px-6">
          <Alert tone="amber">{selectedWithErrors} selected product(s) have errors. They will be skipped until fixed.</Alert>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2 sm:px-6">
                <input
                  type="checkbox"
                  aria-label="Select all filtered products"
                  checked={allFilteredSelected}
                  onChange={() =>
                    setSelection(allFilteredSelected ? state.selection.filter((id) => !filtered.some((p) => p.id === id)) : [...state.selection, ...filtered.map((p) => p.id)])
                  }
                />
              </th>
              <th className="px-2 py-2 font-medium">Row</th>
              <th className="px-2 py-2 font-medium">Product</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">SKU</th>
              <th className="hidden px-2 py-2 font-medium lg:table-cell">Price</th>
              <th className="px-2 py-2 font-medium">Data</th>
              <th className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setEditing(p)}>
                <td className="px-4 py-2 sm:px-6" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${p.fields.name ?? "product"}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
                <td className="px-2 py-2 text-xs text-slate-500">{p.sourceRow || "—"}</td>
                <td className="max-w-xs px-2 py-2">
                  <div className="truncate font-medium text-slate-900">{p.fields.name || <span className="italic text-red-600">No name</span>}</div>
                  <div className="truncate text-xs text-slate-500">{[p.fields.brand, p.fields.category].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="hidden px-2 py-2 text-xs text-slate-600 md:table-cell">{p.fields.sku}</td>
                <td className="hidden px-2 py-2 text-xs text-slate-600 lg:table-cell">{p.fields.price ? `${p.fields.price} ${p.fields.currency ?? ""}` : ""}</td>
                <td className="px-2 py-2">
                  <IssueBadge p={p} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge p={p} />
                    <FlagBadge p={p} />
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                  No products match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm sm:px-6">
          <span className="text-slate-600">
            Page {current + 1} of {pages} · {filtered.length} products
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Drawer open={editing !== null} title={editing === "new" ? "Add product" : editing?.sourceRow ? `Edit row ${editing.sourceRow}` : "Edit product"} onClose={() => setEditing(null)}>
        {editing && editing !== "new" && editing.issues.length > 0 ? (
          <div className="mb-4">
            <Alert tone={editing.issues.some((i) => i.severity === "error") ? "red" : "amber"} title="Data checks">
              <ul className="list-disc pl-5">
                {editing.issues.map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
              </ul>
            </Alert>
          </div>
        ) : null}
        {editing ? (
          <ProductEditor
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? {} : editing.fields}
            submitLabel={editing === "new" ? "Add product" : "Save product"}
            onCancel={() => setEditing(null)}
            onSave={(fields) => {
              if (editing === "new") dispatch({ type: "addProduct", fields });
              else dispatch({ type: "updateFields", id: editing.id, fields });
              setEditing(null);
            }}
          />
        ) : null}
      </Drawer>
    </Card>
  );
}
