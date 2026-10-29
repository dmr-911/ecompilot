import { summarizeWorkspace, type Workspace, type WorkspaceRepository, type WorkspaceSummary } from "./types";

const INDEX_KEY = "listingpilot:workspaces";
const ITEM_KEY = (id: string) => `listingpilot:workspace:${id}`;

/** Browser storage. Data stays on this device; nothing is sent to the server. */
export class LocalStorageRepository implements WorkspaceRepository {
  readonly kind = "browser";

  constructor(private readonly storage: Storage) {}

  private readIndex(): WorkspaceSummary[] {
    try {
      const raw = this.storage.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as WorkspaceSummary[]) : [];
    } catch {
      return [];
    }
  }

  async list() {
    return this.readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async load(id: string) {
    try {
      const raw = this.storage.getItem(ITEM_KEY(id));
      return raw ? (JSON.parse(raw) as Workspace) : null;
    } catch {
      return null;
    }
  }

  async save(workspace: Workspace) {
    try {
      this.storage.setItem(ITEM_KEY(workspace.id), JSON.stringify(workspace));
    } catch (err) {
      throw new Error(
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "Browser storage is full. Export your listings, then delete old workspaces."
          : "Could not save to browser storage.",
      );
    }
    const index = this.readIndex().filter((w) => w.id !== workspace.id);
    index.push(summarizeWorkspace(workspace));
    this.storage.setItem(INDEX_KEY, JSON.stringify(index));
  }

  async remove(id: string) {
    this.storage.removeItem(ITEM_KEY(id));
    this.storage.setItem(INDEX_KEY, JSON.stringify(this.readIndex().filter((w) => w.id !== id)));
  }
}
