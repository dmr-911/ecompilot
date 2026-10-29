import "server-only";
import { summarizeWorkspace, type Workspace, type WorkspaceSummary } from "./types";
import type { ServerWorkspaceStore } from "./server-store";

/**
 * The only thing the store needs from a Postgres driver: run a parameterised
 * query and return its rows. Neon's `neon()` function, node-postgres and
 * PGlite all fit this with a one-line wrapper.
 */
export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const TABLE = "listingpilot_workspaces";

export const WORKSPACES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  owner           text        NOT NULL,
  id              text        NOT NULL,
  name            text        NOT NULL,
  product_count   integer     NOT NULL DEFAULT 0,
  generated_count integer     NOT NULL DEFAULT 0,
  data            jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, id)
);
CREATE INDEX IF NOT EXISTS ${TABLE}_owner_updated_idx ON ${TABLE} (owner, updated_at DESC);
`;

interface SummaryRow {
  id: string;
  name: string;
  product_count: number;
  generated_count: number;
  updated_at: string | Date;
}

/** Workspaces stored in Postgres (Neon or any other). One JSONB document per workspace. */
export class PostgresWorkspaceStore implements ServerWorkspaceStore {
  private ready: Promise<void> | null = null;

  constructor(
    private readonly sql: SqlClient,
    private readonly opts: { autoMigrate?: boolean } = {},
  ) {}

  /** Creates the table on first use unless STORAGE_AUTO_MIGRATE=false (then run `npm run db:migrate`). */
  private ensureSchema(): Promise<void> {
    if (this.opts.autoMigrate === false) return Promise.resolve();
    this.ready ??= (async () => {
      for (const statement of WORKSPACES_SCHEMA_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
        await this.sql.query(statement);
      }
    })().catch((err) => {
      this.ready = null; // retry on the next request
      throw err;
    });
    return this.ready;
  }

  async list(owner: string): Promise<WorkspaceSummary[]> {
    await this.ensureSchema();
    const rows = await this.sql.query<SummaryRow>(
      `SELECT id, name, product_count, generated_count, updated_at FROM ${TABLE} WHERE owner = $1 ORDER BY updated_at DESC LIMIT 200`,
      [owner],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      productCount: Number(r.product_count),
      generatedCount: Number(r.generated_count),
      updatedAt: new Date(r.updated_at).getTime(),
    }));
  }

  async get(owner: string, id: string): Promise<Workspace | null> {
    await this.ensureSchema();
    const rows = await this.sql.query<{ data: Workspace | string }>(`SELECT data FROM ${TABLE} WHERE owner = $1 AND id = $2`, [owner, id]);
    const data = rows[0]?.data;
    if (!data) return null;
    return typeof data === "string" ? (JSON.parse(data) as Workspace) : data;
  }

  async put(owner: string, workspace: Workspace): Promise<void> {
    await this.ensureSchema();
    const s = summarizeWorkspace(workspace);
    await this.sql.query(
      `INSERT INTO ${TABLE} (owner, id, name, product_count, generated_count, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, to_timestamp($7 / 1000.0), to_timestamp($8 / 1000.0))
       ON CONFLICT (owner, id) DO UPDATE SET
         name = EXCLUDED.name,
         product_count = EXCLUDED.product_count,
         generated_count = EXCLUDED.generated_count,
         data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at`,
      [owner, workspace.id, s.name, s.productCount, s.generatedCount, JSON.stringify(workspace), workspace.createdAt, workspace.updatedAt],
    );
  }

  async delete(owner: string, id: string): Promise<void> {
    await this.ensureSchema();
    await this.sql.query(`DELETE FROM ${TABLE} WHERE owner = $1 AND id = $2`, [owner, id]);
  }
}
