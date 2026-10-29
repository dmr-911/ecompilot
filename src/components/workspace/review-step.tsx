"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, Select, cx } from "@/components/ui";
import { useWorkspace } from "./context";
import { ListingEditor } from "./listing-editor";
import { FlagBadge, StatusBadge } from "./status";
import { useGenerationRunner } from "./use-generation";
import { PRODUCT_FIELDS } from "@/lib/products/fields";
import { currentListing } from "@/lib/products/types";
import { getAdapter } from "@/lib/export/registry";
import { worstSeverity, type QualityFlag } from "@/lib/quality/checks";

type ReviewFilter = "all" | "needs" | "unapproved" | "approved" | "failed";

export function ReviewStep() {
  const { state, dispatch, isRunning } = useWorkspace();
  const ws = state.workspace;
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const { run } = useGenerationRunner();
  const constraints = getAdapter(ws.options.marketplace).constraints;

  const items = useMemo(
    () =>
      ws.products.filter((p) => {
        if (filter === "failed") return p.status === "error";
        if (!currentListing(p)) return false;
        if (filter === "needs") return ["error", "warning"].includes(worstSeverity(p.flags) ?? "");
        if (filter === "unapproved") return !p.approved;
        if (filter === "approved") return p.approved;
        return true;
      }),
    [ws.products, filter],
  );
  const active = ws.products.find((p) => p.id === activeId) ?? items[0];
  const listing = active ? currentListing(active) : undefined;
  const generatedCount = ws.products.filter((p) => currentListing(p)).length;
  const cleanUnapproved = ws.products.filter((p) => currentListing(p) && !p.approved && worstSeverity(p.flags) !== "error");

  if (generatedCount === 0 && !ws.products.some((p) => p.status === "error")) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-600">Nothing to review yet. Generate listings first.</p>
        <Button className="mt-4" onClick={() => dispatch({ type: "goto", step: "generate" })}>
          Go to generation
        </Button>
      </Card>
    );
  }

  const idx = items.findIndex((p) => p.id === active?.id);
  const go = (d: number) => {
    const next = items[idx + d];
    if (next) setActiveId(next.id);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[18rem_1fr]">
      <Card className="xl:max-h-[calc(100dvh-10rem)] xl:overflow-hidden">
        <div className="space-y-2 border-b border-slate-200 p-3">
          <Select aria-label="Filter results" value={filter} onChange={(e) => setFilter(e.target.value as ReviewFilter)}>
            <option value="all">All results</option>
            <option value="needs">Needs review (flags)</option>
            <option value="unapproved">Not approved</option>
            <option value="approved">Approved</option>
            <option value="failed">Failed</option>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            disabled={cleanUnapproved.length === 0}
            onClick={() => dispatch({ type: "approve", ids: cleanUnapproved.map((p) => p.id), approved: true })}
          >
            Approve {cleanUnapproved.length} without errors
          </Button>
        </div>
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto xl:max-h-[calc(100dvh-16rem)]">
          {items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActiveId(p.id)}
                className={cx("w-full px-3 py-2 text-left hover:bg-slate-50", p.id === active?.id && "bg-indigo-50")}
              >
                <p className="truncate text-sm font-medium text-slate-900">{p.fields.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <StatusBadge p={p} />
                  <FlagBadge p={p} />
                </div>
              </button>
            </li>
          ))}
          {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-slate-500">Nothing here.</li> : null}
        </ul>
      </Card>

      {active ? (
        <Card>
          <CardHeader
            title={active.fields.name ?? "Product"}
            description={
              active.usage ? `Generated with ${active.usage.model}${active.usage.inputTokens ? ` · ${active.usage.inputTokens} in / ${active.usage.outputTokens} out tokens` : ""}` : undefined
            }
            actions={
              <>
                <Button size="sm" variant="ghost" disabled={idx <= 0} onClick={() => go(-1)}>
                  ← Previous
                </Button>
                <Button size="sm" variant="ghost" disabled={idx < 0 || idx >= items.length - 1} onClick={() => go(1)}>
                  Next →
                </Button>
                <Button size="sm" variant="secondary" disabled={isRunning} onClick={() => run([active.id])}>
                  {active.status === "error" ? "Retry" : "Regenerate"}
                </Button>
                {listing ? (
                  <Button size="sm" variant={active.approved ? "secondary" : "primary"} onClick={() => dispatch({ type: "approve", ids: [active.id], approved: !active.approved })}>
                    {active.approved ? "Unapprove" : "Approve"}
                  </Button>
                ) : null}
              </>
            }
          />
          <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-2">
            <section aria-labelledby="orig-h">
              <h3 id="orig-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Original data
              </h3>
              <dl className="space-y-2 rounded-md bg-slate-50 p-4 text-sm">
                {PRODUCT_FIELDS.filter((f) => active.fields[f.key]).map((f) => (
                  <div key={f.key}>
                    <dt className="text-xs font-medium text-slate-500">{f.label}</dt>
                    <dd className="whitespace-pre-wrap text-slate-900">{active.fields[f.key]}</dd>
                  </div>
                ))}
              </dl>
              {active.flags.length > 0 ? <Flags flags={active.flags} /> : null}
            </section>
            <section aria-labelledby="gen-h">
              <div className="mb-2 flex items-center justify-between">
                <h3 id="gen-h" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Generated listing {active.edited ? <Badge tone="indigo">Edited</Badge> : null}
                </h3>
                {active.edited ? (
                  <button type="button" className="text-xs text-indigo-700 hover:underline" onClick={() => dispatch({ type: "revertListing", id: active.id })}>
                    Revert to generated
                  </button>
                ) : null}
              </div>
              {active.status === "error" ? <Alert tone="red" title="Generation failed">{active.error?.message}</Alert> : null}
              {active.status === "generating" || active.status === "queued" ? <Alert tone="blue">Generating…</Alert> : null}
              {listing ? (
                <ListingEditor
                  key={`${active.id}:${active.updatedAt}:${active.edited ? "e" : "g"}`}
                  listing={listing}
                  constraints={constraints}
                  onSave={(l) => dispatch({ type: "editListing", id: active.id, listing: l })}
                />
              ) : null}
            </section>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Flags({ flags }: { flags: QualityFlag[] }) {
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = [...flags].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-slate-800">Quality checks</h4>
      <ul className="space-y-1 text-sm">
        {sorted.map((f, i) => (
          <li
            key={i}
            className={cx(
              "rounded-md px-3 py-2",
              f.severity === "error" ? "bg-red-50 text-red-800" : f.severity === "warning" ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700",
            )}
          >
            <span className="font-medium capitalize">{f.severity}</span>
            {f.field ? <span className="text-xs opacity-75"> · {f.field}</span> : null}: {f.message}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Checks are automatic and can miss things. Read every listing before you publish it.</p>
    </div>
  );
}
