import "server-only";

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

/** All server configuration, read from environment variables. See .env.example. */
export function getConfig() {
  return {
    appSecret: process.env.APP_SECRET ?? "",
    isProduction: process.env.NODE_ENV === "production",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    openaiDefaultModel: process.env.OPENAI_DEFAULT_MODEL ?? "",
    /** Customers may store their own provider key (encrypted, httpOnly cookie). */
    allowUserKeys: bool("ALLOW_USER_KEYS", true),
    /** Demo provider available without any key. */
    enableDemo: bool("ENABLE_DEMO_PROVIDER", true),
    maxBatchSize: int("MAX_BATCH_SIZE", 10, 1, 50),
    maxProductsPerJob: int("MAX_PRODUCTS_PER_JOB", 500, 1, 10000),
    concurrency: int("GENERATION_CONCURRENCY", 3, 1, 10),
    rateLimitPerMinute: int("RATE_LIMIT_PER_MINUTE", 20, 1, 1000),
    maxUploadBytes: int("MAX_UPLOAD_BYTES", 5 * 1024 * 1024, 1024, 50 * 1024 * 1024),
    maxOutputTokens: int("MAX_OUTPUT_TOKENS", 16000, 1000, 64000),
    modelPricingJson: process.env.MODEL_PRICING_JSON ?? "",
    storageDriver: (process.env.STORAGE_DRIVER ?? (process.env.DATABASE_URL ? "neon" : "none")) as "none" | "memory" | "file" | "neon",
    databaseUrl: process.env.DATABASE_URL ?? "",
    /** Create the workspaces table on first use. Set false if you run `npm run db:migrate` yourself. */
    storageAutoMigrate: bool("STORAGE_AUTO_MIGRATE", true),
    storageDir: process.env.STORAGE_DIR ?? ".data/workspaces",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
