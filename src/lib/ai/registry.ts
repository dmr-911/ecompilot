import type { AIProvider, ProviderId } from "./types";
import { createAnthropicProvider } from "./providers/anthropic";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import { createDemoProvider } from "./providers/demo";

export const PROVIDER_IDS = ["anthropic", "openai", "demo"] as const satisfies readonly ProviderId[];

export interface ProviderSettings {
  anthropicBaseUrl?: string;
  openaiBaseUrl?: string;
  openaiDefaultModel?: string;
  enableDemo: boolean;
}

/** Builds the provider set. Add a provider by writing an AIProvider adapter and registering it here. */
export function createProviders(settings: ProviderSettings): Partial<Record<ProviderId, AIProvider>> {
  const providers: Partial<Record<ProviderId, AIProvider>> = {
    anthropic: createAnthropicProvider({ baseURL: settings.anthropicBaseUrl }),
    openai: createOpenAICompatibleProvider({ baseURL: settings.openaiBaseUrl, defaultModel: settings.openaiDefaultModel }),
  };
  if (settings.enableDemo) providers.demo = createDemoProvider();
  return providers;
}
