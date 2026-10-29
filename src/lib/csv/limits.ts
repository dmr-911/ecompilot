/** Import and processing limits. Override with environment variables on the server. */
export const CSV_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 100,
  maxCellLength: 20000,
} as const;
