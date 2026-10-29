"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, Select } from "@/components/ui";
import { useWorkspace } from "./context";
import { PRODUCT_FIELDS, type ProductFieldKey } from "@/lib/products/fields";
import { applyMapping, mappingProblems, type ColumnMapping } from "@/lib/csv/mapping";
import { buildRecords } from "@/lib/csv/validate";

export function MappingStep() {
  const { state, dispatch } = useWorkspace();
  const pending = state.pendingImport;
  const [mapping, setMapping] = useState<ColumnMapping>(() => pending?.suggestedMapping ?? {});
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const problems = useMemo(() => (pending ? mappingProblems(mapping, pending.headers) : []), [mapping, pending]);
  const preview = useMemo(() => (pending && problems.length === 0 ? buildRecords(pending, mapping) : null), [pending, mapping, problems]);

  if (!pending) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-600">Import a CSV first. Column mapping appears here after upload.</p>
        <Button className="mt-4" variant="secondary" onClick={() => dispatch({ type: "goto", step: "import" })}>
          Go to import
        </Button>
      </Card>
    );
  }

  const samples = pending.rows.slice(0, 3);
  const unmappedHeaders = pending.headers.filter((h) => !Object.values(mapping).includes(h));
  const fileIssues = pending.issues.filter((i) => !i.row || i.row === 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Map columns"
          description={`${pending.fileName ?? "Your file"}: ${pending.rows.length} rows, ${pending.headers.length} columns. We matched what we could; check each field and adjust.`}
        />
        <div className="p-4 sm:p-6">
          {fileIssues.length > 0 ? (
            <div className="mb-4">
              <Alert tone="amber" title="File notes">
                <ul className="list-disc pl-5">
                  {fileIssues.map((i, n) => (
                    <li key={n}>{i.message}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Standard field</th>
                  <th className="py-2 pr-4 font-medium">Your column</th>
                  <th className="py-2 font-medium">Sample values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PRODUCT_FIELDS.map((f) => {
                  const header = mapping[f.key] ?? "";
                  return (
                    <tr key={f.key} className="align-top">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-slate-900">
                          {f.label} {f.required ? <Badge tone="red">Required</Badge> : null}
                        </div>
                        <div className="max-w-xs text-xs text-slate-500">{f.help}</div>
                      </td>
                      <td className="py-2 pr-4">
                        <Select
                          aria-label={`Column for ${f.label}`}
                          value={header}
                          onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                          className="min-w-48"
                        >
                          <option value="">Not mapped</option>
                          {pending.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2 text-xs text-slate-600">
                        {header ? (
                          <ul className="space-y-0.5">
                            {samples.map((r, i) => (
                              <li key={i} className="max-w-md truncate" title={r[header]}>
                                {r[header] || <span className="italic text-slate-400">blank</span>}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {unmappedHeaders.length > 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              Columns not used: {unmappedHeaders.join(", ")}. Map them above or they will be ignored.
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Preview and validate" description="Checks run on every row before anything is sent to an AI provider." />
        <div className="space-y-4 p-4 sm:p-6">
          {problems.length > 0 ? (
            <Alert tone="red" title="Fix the mapping to continue">
              <ul className="list-disc pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          ) : preview ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone="neutral">{preview.summary.total} rows</Badge>
                <Badge tone="green">{preview.summary.valid} valid</Badge>
                <Badge tone={preview.summary.withErrors ? "red" : "neutral"}>{preview.summary.withErrors} with errors</Badge>
                <Badge tone={preview.summary.withWarnings ? "amber" : "neutral"}>{preview.summary.withWarnings} with warnings</Badge>
                <Badge tone={preview.summary.duplicates ? "amber" : "neutral"}>{preview.summary.duplicates} duplicates</Badge>
              </div>
              <RowIssues records={preview.records} />
              <MappedPreview mapping={mapping} rows={pending.rows.slice(0, 5)} />
            </>
          ) : null}
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {state.workspace.products.length > 0 ? (
              <fieldset className="flex gap-4 text-sm">
                <legend className="sr-only">Import mode</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace current {state.workspace.products.length} products
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> Add to current products
                </label>
              </fieldset>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => dispatch({ type: "goto", step: "import" })}>
                Back
              </Button>
              <Button disabled={problems.length > 0} onClick={() => dispatch({ type: "applyMapping", mapping, mode })}>
                Continue with {preview?.summary.total ?? 0} products
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RowIssues({ records }: { records: ReturnType<typeof buildRecords>["records"] }) {
  const withIssues = records.filter((r) => r.issues.length > 0);
  if (withIssues.length === 0) return <Alert tone="green">No row-level problems found.</Alert>;
  return (
    <details className="rounded-md border border-slate-200" open={withIssues.length <= 8}>
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-800">Row-level report ({withIssues.length} rows)</summary>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto text-sm">
        {withIssues.map((r) => (
          <li key={r.id} className="px-4 py-2">
            <span className="font-medium text-slate-900">Row {r.sourceRow}</span>
            <span className="text-slate-500"> · {r.fields.name || "(no name)"}</span>
            <ul className="mt-1 space-y-0.5">
              {r.issues.map((i, n) => (
                <li key={n} className={i.severity === "error" ? "text-red-700" : "text-amber-800"}>
                  {i.severity === "error" ? "Error" : "Warning"}
                  {i.field ? ` (${i.field})` : ""}: {i.message}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

function MappedPreview({ mapping, rows }: { mapping: ColumnMapping; rows: Record<string, string>[] }) {
  const keys = PRODUCT_FIELDS.filter((f) => mapping[f.key]).map((f) => f.key) as ProductFieldKey[];
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50">
          <tr>
            {keys.map((k) => (
              <th key={k} className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">
                {PRODUCT_FIELDS.find((f) => f.key === k)?.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const fields = applyMapping(r, mapping);
            return (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} className="max-w-48 truncate px-3 py-2 text-slate-800" title={fields[k]}>
                    {fields[k] ?? ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
