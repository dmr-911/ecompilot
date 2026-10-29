import "server-only";
import type { ProviderId } from "../ai/types";
import { decrypt, encrypt, resolveSecret } from "./crypto";
import type { AppConfig } from "./config";

export const KEY_COOKIE = "lp_provider_keys";
export const KEY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type StoredKeys = Partial<Record<Exclude<ProviderId, "demo">, string>>;

export function readKeys(cookieValue: string | undefined, config: AppConfig): StoredKeys {
  if (!cookieValue) return {};
  let secret: string;
  try {
    secret = resolveSecret(config.appSecret, config.isProduction);
  } catch {
    return {};
  }
  const json = decrypt(cookieValue, secret);
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as StoredKeys;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function sealKeys(keys: StoredKeys, config: AppConfig): string {
  return encrypt(JSON.stringify(keys), resolveSecret(config.appSecret, config.isProduction));
}

/** Shows enough of a key to recognise it, never enough to use it. */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export type KeySource = "user" | "server" | "none";

/** Customer key wins over the server key so customers are billed on their own account. */
export function resolveApiKey(provider: ProviderId, stored: StoredKeys, config: AppConfig): { key: string; source: KeySource } {
  if (provider === "demo") return { key: "", source: "none" };
  const user = config.allowUserKeys ? stored[provider] : undefined;
  if (user) return { key: user, source: "user" };
  const server = provider === "anthropic" ? config.anthropicApiKey : config.openaiApiKey;
  if (server) return { key: server, source: "server" };
  return { key: "", source: "none" };
}
