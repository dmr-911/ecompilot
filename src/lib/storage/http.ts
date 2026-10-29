import type { Workspace, WorkspaceRepository, WorkspaceSummary } from "./types";

/** Talks to /api/workspaces, which uses the server-side store configured by STORAGE_DRIVER. */
export class HttpWorkspaceRepository implements WorkspaceRepository {
  readonly kind = "server";

  constructor(private readonly base = "/api/workspaces") {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
    if (res.status === 404) return null as T;
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? `Storage request failed (HTTP ${res.status}).`);
    }
    return (await res.json()) as T;
  }

  async list() {
    return (await this.request<{ workspaces: WorkspaceSummary[] }>("")).workspaces;
  }
  async load(id: string) {
    return this.request<Workspace | null>(`/${encodeURIComponent(id)}`);
  }
  async save(workspace: Workspace) {
    await this.request(`/${encodeURIComponent(workspace.id)}`, { method: "PUT", body: JSON.stringify(workspace) });
  }
  async remove(id: string) {
    await this.request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
