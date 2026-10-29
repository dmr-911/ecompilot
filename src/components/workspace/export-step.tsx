"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, CardHeader, Field, Select } from "@/components/ui";
import { useWorkspace } from "./context";
import { EXPORT_ADAPTERS, exportRecords, getAdapter } from "@/lib/export/registry";
import type { MarketplaceId } from "@/lib/generation/options";
import { currentListing } from "@/lib/products/types";
import { worstSeverity } from "@/lib/quality/checks";
import { toCsv } from "@/lib/csv/serialize";
import { PRODUCT_FIELDS } from "@/lib/products/fields";

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportStep() {
  const { state } = useWorkspace();
  const ws = state.workspace;
  const [marketplace, setMarketplace] = useState<MarketplaceId>(ws.options.marketplace);
  const [onlyApproved, setOnlyApproved] = useState(true);
  const adapter = getAdapter(marketplace);

  const result = useMemo(() => exportRecords(ws.products, marketplace, { onlyApproved }), [ws.products, marketplace, onlyApproved]);
  const preview = useMemo(() => {
    const rows = ws.products
      .filter((p) => currentListing(p) && (!onlyApproved || p.approved))
      .slice(0, 3)
      .map((p) => adapter.toRow({ fields: p.fields, listing: currentListing(p)! }));
    return rows;
  }, [ws.products, onlyApproved, adapter]);

  const withErrors = ws.products.filter((p) => currentListing(p) && (!onlyApproved || p.approved) && worstSeverity(p.flags) === "error").length;
  const generated = ws.products.filter((p) => currentListing(p)).length;
  const approved = ws.products.filter((p) => p.approved).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Export listings" description="Download a CSV laid out for your marketplace. Edited versions are exported in place of the originals." />
        <div className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Export profile" htmlFor="exp-profile" hint={adapter.description}>
              <Select id="exp-profile" value={marketplace} onChange={(e) => setMarketplace(e.target.value as MarketplaceId)}>
                {Object.values(EXPORT_ADAPTERS).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-slate-700">Include</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={onlyApproved} onChange={() => setOnlyApproved(true)} /> Approved only ({approved})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!onlyApproved} onChange={() => setOnlyApproved(false)} /> Everything generated ({generated})
              </label>
            </fieldset>
          </div>
          {marketplace !== ws.options.marketplace ? (
            <Alert tone="amber">
              These listings were generated for {getAdapter(ws.options.marketplace).name}. Exporting to {adapter.name} works, but lengths and bullet counts may not fit its limits. Regenerate with this marketplace for the best fit.
            </Alert>
          ) : null}
          {withErrors > 0 ? <Alert tone="red">{withErrors} listing(s) in this export still have error-level quality flags. Review them before publishing.</Alert> : null}
          {result.exported === 0 ? (
            <Alert tone="neutral">{onlyApproved ? "No approved listings yet. Approve listings in Review, or include everything generated." : "Nothing generated yet."}</Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={result.exported === 0} onClick={() => download(result.fileName, result.csv)}>
              Download {result.exported} listing{result.exported === 1 ? "" : "s"} (CSV)
            </Button>
            <Button
              variant="secondary"
              disabled={ws.products.length === 0}
              onClick={() =>
                download(
                  `listingpilot-source-data-${new Date().toISOString().slice(0, 10)}.csv`,
                  toCsv(
                    PRODUCT_FIELDS.map((f) => f.key),
                    ws.products.map((p) => p.fields),
                  ),
                )
              }
            >
              Download cleaned source data
            </Button>
          </div>
        </div>
      </Card>

      {preview.length > 0 ? (
        <Card>
          <CardHeader title="Preview" description={`First ${preview.length} rows, ${adapter.columns.length} columns.`} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {adapter.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row, i) => (
                  <tr key={i}>
                    {adapter.columns.map((c) => (
                      <td key={c} className="max-w-64 truncate px-3 py-2 align-top text-slate-800" title={row[c]}>
                        {row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
