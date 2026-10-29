import "server-only";
import { neon } from "@neondatabase/serverless";
import type { SqlClient } from "./postgres-store";

/**
 * Neon over HTTP: no connection pool to manage, works on serverless and edge
 * hosts. Use the pooled or direct connection string from the Neon console.
 */
export function createNeonClient(connectionString: string): SqlClient {
  const sql = neon(connectionString);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
  };
}
