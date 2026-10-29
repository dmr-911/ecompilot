import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { summarizeWorkspace, type Workspace, type WorkspaceSummary } from "./types";

/**
 * Server-side store, scoped by owner (an anonymous httpOnly cookie id until you
 * add authentication; then pass the user id). Implement this interface to use
 * a database.
 */
export interface ServerWorkspaceStore {
  list(owner: string): Promise<WorkspaceSummary[]>;
  get(owner: string, id: string): Promise<Workspace | null>;
  put(owner: string, workspace: Workspace): Promise<void>;
  delete(owner: string, id: string): Promise<void>;
}

export class MemoryWorkspaceStore implements ServerWorkspaceStore {
  private data = new Map<string, Map<string, Workspace>>();
  private bucket(owner: string) {
    let b = this.data.get(owner);
    if (!b) this.data.set(owner, (b = new Map()));
    return b;
  }
  async list(owner: string) {
    return [...this.bucket(owner).values()].map(summarizeWorkspace).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async get(owner: string, id: string) {
    return this.bucket(owner).get(id) ?? null;
  }
  async put(owner: string, workspace: Workspace) {
    this.bucket(owner).set(workspace.id, workspace);
  }
  async delete(owner: string, id: string) {
    this.bucket(owner).delete(id);
  }
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** JSON files on disk: <dir>/<owner>/<id>.json. Suitable for single-server deployments. */
export class FileWorkspaceStore implements ServerWorkspaceStore {
  constructor(private readonly dir: string) {}

  private file(owner: string, id?: string) {
    if (!SAFE_ID.test(owner) || (id !== undefined && !SAFE_ID.test(id))) throw new Error("Invalid id");
    return id === undefined ? path.join(this.dir, owner) : path.join(this.dir, owner, `${id}.json`);
  }

  async list(owner: string) {
    let names: string[];
    try {
      names = await fs.readdir(this.file(owner));
    } catch {
      return [];
    }
    const out: WorkspaceSummary[] = [];
    for (const n of names.filter((n) => n.endsWith(".json"))) {
      const w = await this.get(owner, n.slice(0, -5));
      if (w) out.push(summarizeWorkspace(w));
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(owner: string, id: string) {
    try {
      return JSON.parse(await fs.readFile(this.file(owner, id), "utf8")) as Workspace;
    } catch {
      return null;
    }
  }

  async put(owner: string, workspace: Workspace) {
    const target = this.file(owner, workspace.id);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(workspace), "utf8");
    await fs.rename(tmp, target);
  }

  async delete(owner: string, id: string) {
    await fs.rm(this.file(owner, id), { force: true });
  }
}
