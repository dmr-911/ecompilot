# Troubleshooting

## Import

| Message | Fix |
| --- | --- |
| "The file looks like a binary file" | You uploaded an Excel workbook. Save as **CSV UTF-8** and upload that. |
| "Row has N values but there are M headers" | A value contains the delimiter without quotes. Quote cells that contain commas, or export again from your spreadsheet. |
| "Malformed CSV: Quoted field unterminated" | A `"` was opened and never closed. Find the row in the report and fix the quote. |
| "The file has N rows; the limit is ..." | Split the file, or raise `MAX_PRODUCTS_PER_JOB` on the server. |
| "The file is larger than 5 MB" | Split the file, or raise `MAX_UPLOAD_BYTES`. |
| Accented characters look wrong | The file isn't UTF-8. Re-export as CSV UTF-8. |
| Prices like `1.299` became `1299.00` | A dot followed by exactly three digits is read as a thousands separator. Write `1.30` or `1,30`. |

## Generation

| Message | Fix |
| --- | --- |
| "Add your API key in Settings" | No customer or server key for that provider. Add one, or pick the demo provider. |
| "The API key was rejected" | Wrong key, or a key for another provider. Replace it in Settings. |
| "No remaining credit or quota" | Add billing on the provider's site, then **Retry failed**. |
| "Rate limit reached" | The app waits and retries automatically. If it keeps happening, lower `MAX_BATCH_SIZE` or `GENERATION_CONCURRENCY`, or ask your provider for higher limits. |
| "The provider does not recognise that model name" | Check the model ID on the Generate step. |
| "The output was cut off" | Lower the FAQ count, or raise `MAX_OUTPUT_TOKENS`. |
| "The model returned output that did not match the listing format" | Retry. If it keeps failing with an OpenAI-compatible server, check that it supports strict JSON-schema output. |
| Price shows "unknown" in the estimate | No price is configured for that model. Add it to `MODEL_PRICING_JSON`. |
| Saved key disappears after a restart | Set `APP_SECRET`. Without it, development servers use a random secret per process. |
| Saved key isn't kept in production | The site must be served over HTTPS; the cookie is `Secure`. |
| "Cross-site request rejected" | A proxy is changing the `Host` header. Forward `Host` or `X-Forwarded-Host` unchanged. |

## Review and export

| Problem | Fix |
| --- | --- |
| Many "number does not appear in the source data" warnings | Usually the model counted something ("2 pockets") or wrote a unit differently. Check each one, or put the figure in the specifications. |
| A supported claim is flagged | The checker looks for the claim words in your source data. Add the fact to the specifications (for example `Warranty: 2 years`). |
| Etsy tags are missing on export | Tags longer than 20 characters are dropped. Shorten them on the Review step. |
| Excel shows `'=` at the start of a cell | Cells that start with `=`, `+`, `-` or `@` are prefixed with `'` to stop spreadsheet formula injection. |

## Saving

| Problem | Fix |
| --- | --- |
| "Browser storage is full" | Export, then delete old workspaces on the Import step. For large catalogues, use server storage. |
| Work doesn't resume | Private windows don't keep browser storage. Check that saving is on in Settings. With Neon, the workspace is tied to the browser's anonymous cookie, so another browser won't see it. |
| "Could not reach workspace storage" | The server can't reach Neon. Check `DATABASE_URL`, that the Neon project isn't suspended or out of quota, and that the host allows outbound HTTPS. |
| `relation "listingpilot_workspaces" does not exist` | `STORAGE_AUTO_MIGRATE=false` but the migration hasn't run. Run `npm run db:migrate`. |
