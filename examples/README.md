# Example files

| File | What it is |
| --- | --- |
| `products-input.csv` | 11 sample products, also used by demo mode. Includes a duplicate SKU (row 9), a missing name (row 10), an invalid price (row 11), a European decimal price (row 8), and a product whose data includes a certification (row 6), so validation and quality checks have something to show. |
| `product-import-template.csv` | Empty template with the recommended headers. |
| `malformed.csv` | Broken CSV for testing error reporting: an unclosed quote, an extra value, a missing name and a bad price. |
| `output-generic.csv` | Export of the 8 valid sample products in the generic all-fields layout. |
| `output-amazon.csv`, `output-shopify.csv`, `output-etsy.csv`, `output-ebay.csv`, `output-woocommerce.csv` | The same products in each marketplace layout. |

The output files were produced with the free **demo template provider**, so the copy simply restates the input facts. They show the export formats, not AI writing quality. Output from a real model will read like marketing copy while keeping the same facts.
