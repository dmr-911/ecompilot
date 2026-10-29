"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, cx } from "@/components/ui";
import { useWorkspace } from "./context";
import { api } from "./api";
import { parseCsv, CsvError } from "@/lib/csv/parse";
import { suggestMapping } from "@/lib/csv/mapping";
import { SAMPLE_CSV } from "@/lib/demo/sample-products";
import { newWorkspace } from "@/lib/workspace/reducer";
import type { WorkspaceSummary } from "@/lib/storage/types";

export function ImportStep() {
  const { state, dispatch, providers, repository, persistence } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState<WorkspaceSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxBytes = providers?.limits.maxUploadBytes ?? 5 * 1024 * 1024;

  useEffect(() => {
    if (!repository || !persistence) return;
    repository.list().then(setSaved).catch(() => setSaved([]));
  }, [repository, persistence, state.workspace.id]);

  const loadDemo = useCallback(() => {
    try {
      const parsed = parseCsv(SAMPLE_CSV);
      dispatch({ type: "reset", workspace: newWorkspace({ name: "Demo catalogue", isDemo: true, provider: "demo" }) });
      dispatch({ type: "importParsed", data: { ...parsed, fileName: "sample-products.csv", suggestedMapping: suggestMapping(parsed.headers) } });
    } catch (err) {
      setError(err instanceof CsvError ? err.message : "Could not load the sample products.");
    }
  }, [dispatch]);

  useEffect(() => {
    const handler = () => loadDemo();
    window.addEventListener("listingpilot:load-demo", handler);
    return () => window.removeEventListener("listingpilot:load-demo", handler);
  }, [loadDemo]);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > maxBytes) {
      setError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${(maxBytes / 1024 / 1024).toFixed(0)} MB; split the file and import it in parts.`);
      return;
    }
    setBusy(true);
    try {
      const data = await api.importCsv(file);
      dispatch({ type: "importParsed", data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function resume(id: string) {
    if (!repository) return;
    const ws = await repository.load(id);
    if (ws) dispatch({ type: "load", workspace: ws });
  }

  async function remove(id: string) {
    if (!repository) return;
    if (!window.confirm("Delete this saved workspace? This cannot be undone.")) return;
    await repository.remove(id);
    setSaved((s) => s.filter((w) => w.id !== id));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Import products"
          description="Upload a CSV with your product names, specifications, prices and any existing descriptions. Column names don't need to match; you map them in the next step."
          actions={
            <>
              <a className="text-sm font-medium text-indigo-700 hover:underline" href="/templates/product-import-template.csv" download>
                Download empty template
              </a>
              <a className="text-sm font-medium text-indigo-700 hover:underline" href="/templates/sample-products.csv" download>
                Download sample CSV
              </a>
            </>
          }
        />
        <div className="space-y-4 p-4 sm:p-6">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className={cx(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
              dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-slate-400",
            )}
          >
            <span className="text-sm font-medium text-slate-900">{busy ? "Reading file…" : "Drop a CSV file here, or click to choose"}</span>
            <span className="mt-1 text-xs text-slate-500">
              CSV (UTF-8), comma, semicolon or tab separated. Up to {(maxBytes / 1024 / 1024).toFixed(0)} MB.
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
          {error ? <Alert tone="red" title="Import failed">{error}</Alert> : null}
          <div className="flex flex-col items-start gap-2 rounded-md bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">No file handy?</p>
              <p className="text-sm text-slate-600">Load 11 sample products, including a few with deliberate problems, and try the full workflow with the free demo generator.</p>
            </div>
            <Button variant="secondary" onClick={loadDemo}>
              Load sample products
            </Button>
          </div>
        </div>
      </Card>

      {saved.length > 0 ? (
        <Card>
          <CardHeader title="Resume saved work" description={repository?.kind === "server" ? "Saved on the server." : "Saved in this browser."} />
          <ul className="divide-y divide-slate-200">
            {saved.map((w) => (
              <li key={w.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {w.name} {w.id === state.workspace.id ? <Badge tone="indigo">Open</Badge> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {w.productCount} products, {w.generatedCount} generated · updated {new Date(w.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => resume(w.id)} disabled={w.id === state.workspace.id}>
                    Open
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(w.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
