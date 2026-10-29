"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, cx } from "@/components/ui";
import { WorkspaceProvider, useWorkspace } from "./context";
import { ImportStep } from "./import-step";
import { MappingStep } from "./mapping-step";
import { ProductsStep } from "./products-step";
import { GenerateStep } from "./generate-step";
import { ReviewStep } from "./review-step";
import { ExportStep } from "./export-step";
import { SettingsStep } from "./settings-step";
import type { StepId } from "@/lib/workspace/reducer";
import { newWorkspace } from "@/lib/workspace/reducer";
import { currentListing } from "@/lib/products/types";

const STEPS: { id: StepId; label: string }[] = [
  { id: "import", label: "Import" },
  { id: "map", label: "Map columns" },
  { id: "products", label: "Products" },
  { id: "generate", label: "Generate" },
  { id: "review", label: "Review" },
  { id: "export", label: "Export" },
];

export function WorkspaceApp() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}

function Shell() {
  const { state, dispatch, saveState, isRunning } = useWorkspace();
  const ws = state.workspace;
  const [renaming, setRenaming] = useState(false);
  const counts: Partial<Record<StepId, number>> = {
    products: ws.products.length,
    generate: state.selection.length,
    review: ws.products.filter((p) => currentListing(p)).length,
    export: ws.products.filter((p) => p.approved).length,
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-base font-semibold text-slate-900">
            ListingPilot <span className="text-indigo-600">AI</span>
          </Link>
          <span className="text-slate-300">/</span>
          {renaming ? (
            <input
              autoFocus
              aria-label="Workspace name"
              defaultValue={ws.name}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              onBlur={(e) => {
                dispatch({ type: "rename", name: e.target.value.trim() });
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setRenaming(false);
              }}
            />
          ) : (
            <button type="button" className="truncate text-sm text-slate-700 hover:underline" onClick={() => setRenaming(true)} title="Rename workspace">
              {ws.name}
            </button>
          )}
          {ws.isDemo ? <Badge tone="amber">Demo</Badge> : null}
          <span className="text-xs text-slate-500" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : saveState === "off" ? "Not saving" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              disabled={isRunning}
              onClick={() => {
                if (ws.products.length === 0 || window.confirm("Start a new workspace? The current one stays saved if saving is on.")) {
                  dispatch({ type: "reset", workspace: newWorkspace() });
                }
              }}
            >
              New
            </button>
            <button
              type="button"
              className={cx("rounded-md px-3 py-1.5 text-sm hover:bg-slate-100", state.step === "settings" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700")}
              onClick={() => dispatch({ type: "goto", step: "settings" })}
            >
              Settings
            </button>
          </div>
        </div>
        <nav aria-label="Workflow steps" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <ol className="flex gap-1">
            {STEPS.map((s, i) => {
              const active = state.step === s.id;
              const disabled = s.id === "map" && !state.pendingImport;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-current={active ? "step" : undefined}
                    onClick={() => dispatch({ type: "goto", step: s.id })}
                    className={cx(
                      "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                      active ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className={cx("flex h-5 w-5 items-center justify-center rounded-full text-xs", active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700")}>{i + 1}</span>
                    {s.label}
                    {counts[s.id] ? <span className="text-xs text-slate-500">({counts[s.id]})</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {state.step === "import" ? <ImportStep /> : null}
        {state.step === "map" ? <MappingStep key={state.pendingImport ? `${state.pendingImport.fileName}:${state.pendingImport.rows.length}` : "none"} /> : null}
        {state.step === "products" ? <ProductsStep /> : null}
        {state.step === "generate" ? <GenerateStep key={ws.id} /> : null}
        {state.step === "review" ? <ReviewStep /> : null}
        {state.step === "export" ? <ExportStep /> : null}
        {state.step === "settings" ? <SettingsStep /> : null}
      </main>
    </div>
  );
}
