import "server-only";
import { getConfig } from "./config";
import { createProviders } from "../ai/registry";
import { createMemoryRateLimiter } from "./rate-limit";
import type { HandlerDeps } from "./handlers";
import { FileWorkspaceStore, MemoryWorkspaceStore, type ServerWorkspaceStore } from "../storage/server-store";

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
    store:
      config.storageDriver === "file"
        ? new FileWorkspaceStore(config.storageDir)
        : config.storageDriver === "memory"
          ? new MemoryWorkspaceStore()
          : null,
  };
  return deps;
}
