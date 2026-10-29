import Papa from "papaparse";
import { CSV_LIMITS } from "./limits";

export interface CsvParseIssue {
  /** 1-based line in the file, header = 1. Undefined for file-level problems. */
  row?: number;
  message: string;
  severity: "error" | "warning";
}

export interface ParsedCsv {
  headers: string[];
  /** Data rows keyed by header, in file order. */
  rows: Record<string, string>[];
  /** Row number (1-based, header = 1) for each entry in `rows`. */
  rowNumbers: number[];
  issues: CsvParseIssue[];
  delimiter: string;
}

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

export interface ParseOptions {
  maxRows?: number;
  maxColumns?: number;
  maxCellLength?: number;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parses CSV text into header-keyed rows with row-level issue reporting.
 * Throws CsvError for problems that make the whole file unusable.
 */
export function parseCsv(input: string, options: ParseOptions = {}): ParsedCsv {
  const maxRows = options.maxRows ?? CSV_LIMITS.maxRows;
  const maxColumns = options.maxColumns ?? CSV_LIMITS.maxColumns;
  const maxCellLength = options.maxCellLength ?? CSV_LIMITS.maxCellLength;

  const text = stripBom(input);
  if (text.trim() === "") throw new CsvError("The file is empty.");
  if (text.includes("\u0000")) {
    throw new CsvError("The file looks like a binary file, not a CSV. Export it as CSV (UTF-8) and try again.");
  }

  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
  });

  const issues: CsvParseIssue[] = [];
  const raw = result.data;
  if (raw.length === 0) throw new CsvError("No rows were found in the file.");

  const headerRow = raw[0].map((h) => h.trim());
  if (headerRow.length > maxColumns) {
    throw new CsvError(`The file has ${headerRow.length} columns; the limit is ${maxColumns}.`);
  }
  if (headerRow.every((h) => h === "")) throw new CsvError("The first row must contain column headers.");

  // Make headers unique and non-empty so every column can be mapped.
  const seen = new Map<string, number>();
  const headers = headerRow.map((h, i) => {
    const base = h === "" ? `Column ${i + 1}` : h;
    const count = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), count + 1);
    if (count > 0) {
      issues.push({ row: 1, severity: "warning", message: `Duplicate header "${base}" renamed to "${base} (${count + 1})".` });
      return `${base} (${count + 1})`;
    }
    if (h === "") issues.push({ row: 1, severity: "warning", message: `Column ${i + 1} has no header; named "${base}".` });
    return base;
  });

  const dataRows = raw.slice(1);
  if (dataRows.length === 0) throw new CsvError("The file has headers but no product rows.");
  if (dataRows.length > maxRows) {
    throw new CsvError(`The file has ${dataRows.length} rows; the limit is ${maxRows}. Split it into smaller files.`);
  }

  // Papa reports quote/delimiter errors by data index (0-based including header).
  for (const err of result.errors) {
    const row = typeof err.row === "number" ? err.row + 1 : undefined;
    if (err.code === "UndetectableDelimiter") continue; // single-column files are fine
    issues.push({ row, severity: "error", message: `Malformed CSV: ${err.message}` });
  }

  const rows: Record<string, string>[] = [];
  const rowNumbers: number[] = [];
  dataRows.forEach((cells, idx) => {
    const rowNumber = idx + 2;
    if (cells.length > headers.length && cells.slice(headers.length).some((c) => c.trim() !== "")) {
      issues.push({
        row: rowNumber,
        severity: "error",
        message: `Row has ${cells.length} values but there are ${headers.length} headers. Check for unquoted commas.`,
      });
    } else if (cells.length < headers.length) {
      issues.push({
        row: rowNumber,
        severity: "warning",
        message: `Row has ${cells.length} values but there are ${headers.length} headers; missing values were left blank.`,
      });
    }
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      let value = (cells[i] ?? "").trim();
      if (value.length > maxCellLength) {
        issues.push({ row: rowNumber, severity: "warning", message: `"${h}" was truncated to ${maxCellLength} characters.` });
        value = value.slice(0, maxCellLength);
      }
      record[h] = value;
    });
    rows.push(record);
    rowNumbers.push(rowNumber);
  });

  return { headers, rows, rowNumbers, issues, delimiter: result.meta.delimiter };
}
