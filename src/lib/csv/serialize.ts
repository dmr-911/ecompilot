import Papa from "papaparse";

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Neutralises spreadsheet formula injection (CWE-1236): cells that start with
 * = + - @ tab or CR are prefixed with a single quote, unless they are plain numbers.
 */
export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (FORMULA_PREFIX.test(s) && !NUMERIC.test(s)) return `'${s}`;
  return s;
}

export interface CsvOptions {
  /** Prepend a UTF-8 BOM so Excel opens non-ASCII text correctly. Default true. */
  bom?: boolean;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[], options: CsvOptions = {}): string {
  const data = rows.map((r) => columns.map((c) => sanitizeCell(r[c])));
  const csv = Papa.unparse({ fields: columns, data }, { quotes: false, newline: "\r\n" });
  return (options.bom ?? true ? "﻿" : "") + csv + "\r\n";
}
