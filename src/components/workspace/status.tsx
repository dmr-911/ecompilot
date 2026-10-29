"use client";

import { Badge } from "@/components/ui";
import type { ProductRecord } from "@/lib/products/types";
import { worstSeverity } from "@/lib/quality/checks";

export function StatusBadge({ p }: { p: ProductRecord }) {
  switch (p.status) {
    case "queued":
      return <Badge tone="neutral">Queued</Badge>;
    case "generating":
      return <Badge tone="blue">Generating…</Badge>;
    case "error":
      return <Badge tone="red">Failed</Badge>;
    case "done":
      return p.approved ? <Badge tone="green">Approved</Badge> : <Badge tone="indigo">{p.edited ? "Edited" : "Generated"}</Badge>;
    default:
      return <Badge tone="neutral">Not generated</Badge>;
  }
}

export function IssueBadge({ p }: { p: ProductRecord }) {
  const errors = p.issues.filter((i) => i.severity === "error").length;
  const warnings = p.issues.filter((i) => i.severity === "warning").length;
  if (errors) return <Badge tone="red">{errors} error{errors > 1 ? "s" : ""}</Badge>;
  if (p.duplicateOf) return <Badge tone="amber">Duplicate</Badge>;
  if (warnings) return <Badge tone="amber">{warnings} warning{warnings > 1 ? "s" : ""}</Badge>;
  return <Badge tone="green">Valid</Badge>;
}

export function FlagBadge({ p }: { p: ProductRecord }) {
  const worst = worstSeverity(p.flags);
  if (!worst || !p.generated) return null;
  const n = p.flags.filter((f) => f.severity !== "info").length;
  if (worst === "error") return <Badge tone="red">{n} to review</Badge>;
  if (worst === "warning") return <Badge tone="amber">{n} to review</Badge>;
  return <Badge tone="neutral">Notes</Badge>;
}
