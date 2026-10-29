"use client";

import { useState } from "react";
import { demoListing } from "@/lib/ai/providers/demo";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts/templates";
import { DEFAULT_OPTIONS } from "@/lib/generation/options";
import { runQualityChecks } from "@/lib/quality/checks";
import type { ProductFields } from "@/lib/products/fields";

const RAW: ProductFields = {
  sku: "LP-1001",
  name: "Insulated Steel Water Bottle",
  brand: "Northpeak",
  category: "Drinkware",
  price: "24.99",
  currency: "USD",
  specifications: "Capacity: 750 ml; Insulation: double-wall vacuum; Keeps cold: up to 24 hours; Keeps hot: up to 12 hours",
  materials: "18/8 stainless steel",
  color: "Forest Green",
  size: "750 ml",
};

/** Runs the real prompt builder, demo generator and quality checks in the browser. */
export function WorkflowDemo() {
  const [claim, setClaim] = useState(false);
  const listing = demoListing(buildUserPrompt(RAW), buildSystemPrompt(DEFAULT_OPTIONS));
  const shown = claim ? { ...listing, shortDescription: `${listing.shortDescription} BPA-free and backed by a lifetime warranty.` } : listing;
  const flags = runQualityChecks(RAW, shown, DEFAULT_OPTIONS).filter((f) => f.severity !== "info");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your CSV row</p>
        <dl className="mt-3 space-y-1 text-sm">
          {Object.entries(RAW).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
              <dd className="text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing + quality checks</p>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={claim} onChange={(e) => setClaim(e.target.checked)} />
            Simulate an invented claim
          </label>
        </div>
        <h3 className="mt-3 font-medium text-slate-900">{shown.title}</h3>
        <p className="mt-2 text-sm text-slate-700">{shown.shortDescription}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {shown.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="mt-4 space-y-1">
          {flags.length === 0 ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">No unsupported claims found.</p>
          ) : (
            flags.map((f, i) => (
              <p key={i} className={`rounded-md px-3 py-2 text-xs ${f.severity === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
                {f.message}
              </p>
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">This preview uses the free demo template. Connect an AI provider for written copy in 18 languages.</p>
      </div>
    </div>
  );
}
