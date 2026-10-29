// Applies db/migrations/*.sql to DATABASE_URL in file-name order.
// Usage: DATABASE_URL=postgres://... npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const sql = neon(url);
const dir = path.join(import.meta.dirname, "..", "db", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  const text = await readFile(path.join(dir, file), "utf8");
  const statements = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`applied ${file}`);
}
