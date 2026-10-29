import "server-only";
import { getConfig } from "./config";
import { createProviders } from "../ai/registry";
import { createMemoryRateLimiter } from "./rate-limit";
import type { HandlerDeps } from "./handlers";
import { FileWorkspaceStore, MemoryWorkspaceStore, type ServerWorkspaceStore } from "../storage/server-store";
import { PostgresWorkspaceStore } from "../storage/postgres-store";
import { createNeonClient } from "../storage/neon";
import type { AppConfig } from "./config";

function createStore(config: AppConfig): ServerWorkspaceStore | null {
  switch (config.storageDriver) {
    case "neon":
      if (!config.databaseUrl) throw new Error("STORAGE_DRIVER=neon needs DATABASE_URL (your Neon connection string).");
      return new PostgresWorkspaceStore(createNeonClient(config.databaseUrl), { autoMigrate: config.storageAutoMigrate });
    case "file":
      return new FileWorkspaceStore(config.storageDir);
    case "memory":
      return new MemoryWorkspaceStore();
    default:
      return null;
  }
}

let deps: (HandlerDeps & { store: ServerWorkspaceStore | null }) | undefined;

/** Process-wide singletons. Route handlers call this; tests build their own deps. */
export function getDeps() {
  if (deps) return deps;
  const config = getConfig();
  deps = {
    config,
    providers: createProviders({
      anthropicBaseUrl: config.anthropicBaseUrl,
      openaiBaseUrl: config.openaiBaseUrl,
      openaiDefaultModel: config.openaiDefaultModel,
      enableDemo: config.enableDemo,
    }),
    generateLimiter: createMemoryRateLimiter(config.rateLimitPerMinute, 60_000),
    importLimiter: createMemoryRateLimiter(30, 60_000),
    store: createStore(config),
  };
  return deps;
}
