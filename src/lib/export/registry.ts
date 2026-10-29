import type { MarketplaceId } from "../generation/options";
import type { ProductRecord } from "../products/types";
import { currentListing } from "../products/types";
import { toCsv } from "../csv/serialize";
import type { ExportAdapter } from "./types";
import { genericAdapter } from "./adapters/generic";
import { amazonAdapter } from "./adapters/amazon";
import { shopifyAdapter } from "./adapters/shopify";
import { etsyAdapter } from "./adapters/etsy";
import { ebayAdapter } from "./adapters/ebay";
import { woocommerceAdapter } from "./adapters/woocommerce";

export const EXPORT_ADAPTERS: Record<MarketplaceId, ExportAdapter> = {
  generic: genericAdapter,
  amazon: amazonAdapter,
  shopify: shopifyAdapter,
  etsy: etsyAdapter,
  ebay: ebayAdapter,
  woocommerce: woocommerceAdapter,
};

export function getAdapter(id: MarketplaceId): ExportAdapter {
  return EXPORT_ADAPTERS[id] ?? genericAdapter;
}

export interface ExportResult {
  csv: string;
  exported: number;
  skipped: { id: string; reason: string }[];
  fileName: string;
}

export function exportRecords(
  records: ProductRecord[],
  marketplace: MarketplaceId,
  opts: { onlyApproved?: boolean; date?: Date } = {},
): ExportResult {
  const adapter = getAdapter(marketplace);
  const skipped: ExportResult["skipped"] = [];
  const rows: Record<string, string>[] = [];
  for (const r of records) {
    const listing = currentListing(r);
    if (!listing) {
      skipped.push({ id: r.id, reason: "No generated listing" });
      continue;
    }
    if (opts.onlyApproved && !r.approved) {
      skipped.push({ id: r.id, reason: "Not approved" });
      continue;
    }
    rows.push(adapter.toRow({ fields: r.fields, listing }));
  }
  const date = (opts.date ?? new Date()).toISOString().slice(0, 10);
  return {
    csv: toCsv(adapter.columns, rows),
    exported: rows.length,
    skipped,
    fileName: `listingpilot-${adapter.fileSlug}-${date}.csv`,
  };
}
