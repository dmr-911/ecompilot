# Using ListingPilot

## 1. Import

Upload a CSV (UTF-8; comma, semicolon, tab or pipe separated; up to 5 MB by default). Column names don't need to match anything. Download the [empty template](../public/templates/product-import-template.csv) or the [sample file](../examples/products-input.csv) to start from.

Spreadsheet tips:

- Excel: **File → Save As → CSV UTF-8**. Plain "CSV" can break accented characters.
- Put specifications as `Key: Value` pairs separated by `;` or new lines, e.g. `Capacity: 750 ml; Material: steel`. This gives the model clean facts.
- Put existing bullets in one column separated by `|`.

## 2. Map columns

Each standard field (name, SKU, brand, price, specifications, and so on) gets one of your columns. Common header names are matched automatically. Only **Product name** is required. Sample values are shown for each mapping so you can check it.

The preview shows how many rows are valid, have errors or warnings, or are duplicates, with a row-by-row report.

When products are already loaded, you can replace them or add the new file to them.

## 3. Products

- **Search** by name, SKU, brand, category or generated title.
- **Filter** by validation state, generation state, review flags or approval.
- **Select** rows individually, select everything matching a filter, or **Select all valid**.
- **Click a row** to edit it. Fixes are re-validated and duplicate checks re-run immediately.

Rows with errors (missing name, invalid price, bad GTIN or URL) are skipped at generation until fixed. Duplicates are not selected by default.

Duplicates are detected by SKU (ignoring case and spaces). Rows without a SKU are compared by brand, name, size and color.

## 4. Generate

Choose:

- **Provider and model.** The demo provider is free and template-based. Anthropic and OpenAI-compatible providers bill your account.
- **Marketplace format.** Sets title, bullet and description limits and marketplace-specific writing rules.
- **Language** (18 options), **tone**, **output style** and **FAQ count**.
- **Required keywords.** Used only where true for the product; any that are missing are flagged.
- **Prohibited phrases.** Any listing that contains one gets an error flag.
- **Brand voice notes.**

Click **Estimate** for a token and cost range. Jobs over 50 products, over $1 estimated, or for a model without a price need a confirmation tick before they start.

The job runs in batches with a progress bar. You can cancel at any time; finished products are kept. If the provider or the server rate-limits, the app waits and retries automatically. Failed products can be retried with **Retry failed**. If the key is invalid or the account has no quota, the job stops at once with one clear error.

## 5. Review

Each product shows the original data on the left and the generated listing on the right. Character counters turn red when a field exceeds the marketplace limit.

Quality checks:

| Severity | Meaning |
| --- | --- |
| Error | Possible unsupported claim (certification, warranty, free-from, medical, environmental, origin, superlative, and similar), prohibited phrase, or empty title |
| Warning | A number that isn't in the source data, a missing required keyword, or a field over the limit |
| Info | Information the model said was missing, or bullet count differences |

The checks are pattern-based and work best on English output. They point you at likely problems; they don't replace reading the listing.

Edit any field and **Save edits**. **Revert to generated** restores the model's version. **Approve** marks a listing ready for export, and **Approve all without errors** does it in bulk.

## 6. Export

Pick an export profile and whether to include only approved listings. A preview shows the first rows. Files are UTF-8 with a BOM so Excel opens them correctly.

| Profile | Columns |
| --- | --- |
| Generic | Every generated field, five bullet columns, FAQs as JSON, original identifiers |
| Amazon | `item_sku`, `item_name`, `bullet_point1-5`, `product_description`, `generic_keywords`, price, identifiers. Paste into your category's flat-file template. |
| Shopify | Product CSV import columns, HTML body with bullets and FAQ, tags, SEO fields. Products are exported unpublished. |
| Etsy | Title, plain-text description, 13 tags of up to 20 characters |
| eBay | 80-character title, subtitle, HTML description, identifiers |
| WooCommerce | Product importer columns with HTML short and long descriptions |

**Download cleaned source data** exports your corrected input in the standard field layout.

## Saving and resuming

Work is saved automatically: in the Neon database when the operator set `DATABASE_URL`, otherwise in the browser. Saved workspaces are listed on the Import step. Turn saving off in Settings.
