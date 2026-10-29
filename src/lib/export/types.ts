import type { ProductFields } from "../products/fields";
import type { GeneratedListing } from "../prompts/output-schema";
import type { MarketplaceId } from "../generation/options";

export interface MarketplaceConstraints {
  titleMaxLength: number;
  bulletCount: number;
  bulletMaxLength: number;
  shortDescriptionMaxLength: number;
  longDescriptionMaxLength: number;
  metaTitleMaxLength: number;
  metaDescriptionMaxLength: number;
  /** Max number of keywords/tags the marketplace accepts. */
  keywordLimit: number;
  /** Max length of a single tag, where the marketplace enforces one. */
  keywordMaxLength?: number;
}

export interface ExportItem {
  fields: ProductFields;
  listing: GeneratedListing;
}

/**
 * A marketplace profile: generation constraints + prompt guidance + CSV layout.
 * Add a marketplace by writing one of these and registering it in ./registry.ts.
 */
export interface ExportAdapter {
  id: MarketplaceId;
  name: string;
  description: string;
  constraints: MarketplaceConstraints;
  /** Extra instructions appended to the generation prompt. */
  promptGuidance: string;
  columns: string[];
  toRow(item: ExportItem): Record<string, string>;
  /** File name suffix, e.g. "shopify". */
  fileSlug: string;
}
