import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

let devSecret: string | undefined;

/**
 * Returns the key-encryption secret. In production APP_SECRET is required; in
 * development a random per-process secret is used (stored keys are lost on restart).
 */
export function resolveSecret(appSecret: string, isProduction: boolean): string {
  if (appSecret && appSecret.length >= 32) return appSecret;
  if (isProduction) {
    throw new Error("APP_SECRET must be set to at least 32 characters to store customer API keys.");
  }
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(`listingpilot:key-vault:${secret}`).digest();
}

/** AES-256-GCM. Output: base64url(iv | tag | ciphertext). */
export function encrypt(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function decrypt(token: string, secret: string): string | null {
  try {
    const buf = Buffer.from(token, "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
