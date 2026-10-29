import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PostgresWorkspaceStore, WORKSPACES_SCHEMA_SQL, type SqlClient } from "@/lib/storage/postgres-store";
import { handleDeleteWorkspace, handleGetWorkspace, handleListWorkspaces, handlePutWorkspace } from "@/lib/server/workspace-handlers";
import { newWorkspace } from "@/lib/workspace/reducer";
import { listing } from "./helpers";

/** Real Postgres (WASM build) standing in for Neon, through the same SqlClient interface. */
function pgliteClient(db: PGlite): SqlClient & { statements: string[] } {
  const statements: string[] = [];
  return {
    statements,
    async query<T>(text: string, params: unknown[] = []) {
      statements.push(text);
      return (await db.query(text, params)).rows as T[];
    },
  };
}

function workspace(over = {}) {
  return newWorkspace({
    name: "Spring catalogue",
    products: [
      { id: "p1", sourceRow: 2, fields: { name: "Mug" }, issues: [], status: "done", flags: [], approved: true, updatedAt: 1, generated: listing() },
      { id: "p2", sourceRow: 3, fields: { name: "Plate" }, issues: [], status: "idle", flags: [], approved: false, updatedAt: 1 },
    ],
    ...over,
  });
}

describe("PostgresWorkspaceStore (Neon)", () => {
  let db: PGlite;
  let client: ReturnType<typeof pgliteClient>;
  let store: PostgresWorkspaceStore;

  beforeEach(async () => {
    db = new PGlite();
    client = pgliteClient(db);
    store = new PostgresWorkspaceStore(client);
  });

  it("creates its table on first use and round-trips a workspace", async () => {
    const ws = workspace();
    await store.put("owner-a", ws);
    expect(await store.get("owner-a", ws.id)).toEqual(ws);
    expect(client.statements.filter((s) => s.startsWith("CREATE TABLE"))).toHaveLength(1);
  });

  it("lists summaries newest first, scoped by owner", async () => {
    const older = workspace({ name: "Old", updatedAt: Date.now() - 60_000 });
    const newer = workspace({ name: "New", updatedAt: Date.now() });
    await store.put("owner-a", older);
    await store.put("owner-a", newer);
    await store.put("owner-b", workspace({ name: "Someone else" }));
    const list = await store.list("owner-a");
    expect(list.map((w) => w.name)).toEqual(["New", "Old"]);
    expect(list[0]).toMatchObject({ productCount: 2, generatedCount: 1 });
    expect(Math.abs(list[0].updatedAt - newer.updatedAt)).toBeLessThan(5);
    expect(await store.get("owner-b", older.id)).toBeNull();
  });

  it("updates in place on save and deletes", async () => {
    const ws = workspace();
    await store.put("o", ws);
    await store.put("o", { ...ws, name: "Renamed", updatedAt: ws.updatedAt + 1000 });
    expect(await store.list("o")).toHaveLength(1);
    expect((await store.get("o", ws.id))?.name).toBe("Renamed");
    await store.delete("o", ws.id);
    expect(await store.get("o", ws.id)).toBeNull();
  });

  it("passes values as parameters, never inside the SQL text", async () => {
    const ws = workspace({ name: "x'); DROP TABLE listingpilot_workspaces; --" });
    await store.put("o", ws);
    expect((await store.get("o", ws.id))?.name).toBe(ws.name);
    expect(client.statements.join("\n")).not.toContain("DROP TABLE");
  });

  it("can skip auto-migration when the schema is managed separately", async () => {
    const manual = new PostgresWorkspaceStore(client, { autoMigrate: false });
    await expect(manual.list("o")).rejects.toThrow();
    await db.exec(readFileSync(path.join(import.meta.dirname, "..", "db/migrations/001_workspaces.sql"), "utf8"));
    expect(await manual.list("o")).toEqual([]);
  });

  it("keeps the migration file and the built-in schema in sync", () => {
    const norm = (sql: string) =>
      sql
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    const file = readFileSync(path.join(import.meta.dirname, "..", "db/migrations/001_workspaces.sql"), "utf8");
    expect(norm(file)).toBe(norm(WORKSPACES_SCHEMA_SQL));
  });

  it("serves save-and-resume through the workspace API", async () => {
    const ws = workspace();
    const base = "http://localhost:3000/api/workspaces";
    const put = await handlePutWorkspace(new Request(`${base}/${ws.id}`, { method: "PUT", body: JSON.stringify(ws) }), store, ws.id);
    expect(put.status).toBe(200);
    const cookie = put.headers.get("set-cookie")!.split(";")[0];
    const list = await (await handleListWorkspaces(new Request(base, { headers: { cookie } }), store)).json();
    expect(list.workspaces).toHaveLength(1);
    const got = await (await handleGetWorkspace(new Request(`${base}/${ws.id}`, { headers: { cookie } }), store, ws.id)).json();
    expect(got.products).toHaveLength(2);
    // A different browser (no cookie) sees nothing.
    expect((await (await handleListWorkspaces(new Request(base), store)).json()).workspaces).toEqual([]);
    await handleDeleteWorkspace(new Request(`${base}/${ws.id}`, { method: "DELETE", headers: { cookie } }), store, ws.id);
    expect((await handleGetWorkspace(new Request(`${base}/${ws.id}`, { headers: { cookie } }), store, ws.id)).status).toBe(404);
  });

  it("returns 503 with a helpful message when the database is unreachable", async () => {
    const down = new PostgresWorkspaceStore({
      query: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });
    const res = await handleListWorkspaces(new Request("http://localhost:3000/api/workspaces"), down);
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toMatch(/still in this tab/);
  });
});
