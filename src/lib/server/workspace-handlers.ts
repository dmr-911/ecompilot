import { randomBytes } from "node:crypto";
import { workspaceShapeSchema, type Workspace } from "../storage/types";
import type { ServerWorkspaceStore } from "../storage/server-store";
import { apiError, getCookie, json, readJson, sameOrigin, serializeCookie } from "./http";

export const OWNER_COOKIE = "lp_owner";
const OWNER_RE = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_WORKSPACE_BYTES = 20 * 1024 * 1024;

function owner(request: Request): { id: string; setCookie?: string } {
  const existing = getCookie(request, OWNER_COOKIE);
  if (existing && OWNER_RE.test(existing)) return { id: existing };
  const id = randomBytes(18).toString("base64url");
  return {
    id,
    setCookie: serializeCookie(OWNER_COOKIE, id, { maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production" }),
  };
}

function withOwnerCookie(res: Response, setCookie?: string) {
  if (setCookie) res.headers.append("set-cookie", setCookie);
  return res;
}

function storageFailed() {
  return apiError(503, "storage_unavailable", "Could not reach workspace storage. Your work is still in this tab; try again shortly.");
}

function disabled() {
  return apiError(404, "storage_disabled", "Server storage is not enabled. Set DATABASE_URL (Neon) or STORAGE_DRIVER=file to enable it.");
}

export async function handleListWorkspaces(request: Request, store: ServerWorkspaceStore | null) {
  if (!store) return disabled();
  const o = owner(request);
  try {
    return withOwnerCookie(json({ workspaces: await store.list(o.id) }), o.setCookie);
  } catch {
    return storageFailed();
  }
}

export async function handleGetWorkspace(request: Request, store: ServerWorkspaceStore | null, id: string) {
  if (!store) return disabled();
  const o = owner(request);
  let w;
  try {
    w = await store.get(o.id, id);
  } catch {
    return storageFailed();
  }
  if (!w) return withOwnerCookie(apiError(404, "not_found", "Workspace not found."), o.setCookie);
  return withOwnerCookie(json(w), o.setCookie);
}

export async function handlePutWorkspace(request: Request, store: ServerWorkspaceStore | null, id: string) {
  if (!store) return disabled();
  if (!sameOrigin(request)) return apiError(403, "forbidden", "Cross-site request rejected.");
  const o = owner(request);
  const read = await readJson(request, MAX_WORKSPACE_BYTES);
  if (!read.ok) return read.response;
  const parsed = workspaceShapeSchema.safeParse(read.body);
  if (!parsed.success || parsed.data.id !== id) return apiError(400, "invalid_workspace", "Workspace data is invalid.");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return apiError(400, "invalid_workspace", "Workspace id is invalid.");
  try {
    await store.put(o.id, parsed.data as unknown as Workspace);
  } catch {
    return storageFailed();
  }
  return withOwnerCookie(json({ ok: true }), o.setCookie);
}

export async function handleDeleteWorkspace(request: Request, store: ServerWorkspaceStore | null, id: string) {
  if (!store) return disabled();
  if (!sameOrigin(request)) return apiError(403, "forbidden", "Cross-site request rejected.");
  const o = owner(request);
  try {
    await store.delete(o.id, id);
  } catch {
    return storageFailed();
  }
  return withOwnerCookie(json({ ok: true }), o.setCookie);
}
