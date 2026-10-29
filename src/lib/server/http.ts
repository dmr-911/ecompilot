import type { ApiErrorBody } from "../api/schemas";
import type { z } from "zod";

export function json<T>(body: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function apiError(status: number, code: string, message: string, extra: Partial<ApiErrorBody["error"]> = {}, headers?: HeadersInit): Response {
  return json<ApiErrorBody>({ error: { code, message, ...extra } }, { status, headers });
}

export function zodDetails(error: z.ZodError) {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

export async function readJson(request: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > maxBytes) return { ok: false, response: apiError(413, "payload_too_large", `Request body is larger than ${Math.round(maxBytes / 1024)} KB.`) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: apiError(400, "invalid_body", "Could not read the request body.") };
  }
  if (text.length > maxBytes) return { ok: false, response: apiError(413, "payload_too_large", `Request body is larger than ${Math.round(maxBytes / 1024)} KB.`) };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: apiError(400, "invalid_json", "Request body must be valid JSON.") };
  }
}

export function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, opts: { maxAge: number; secure: boolean }): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/api", "HttpOnly", "SameSite=Strict", `Max-Age=${opts.maxAge}`];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite=Strict). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers and server-to-server calls
  try {
    const host = new URL(origin).host;
    const allowed = [new URL(request.url).host, request.headers.get("x-forwarded-host"), request.headers.get("host")];
    return allowed.includes(host);
  } catch {
    return false;
  }
}
