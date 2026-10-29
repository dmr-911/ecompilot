import { connection } from "next/server";
import { getDeps } from "@/lib/server/deps";
import { handleImport } from "@/lib/server/handlers";

export async function POST(request: Request) {
  await connection();
  return handleImport(request, getDeps());
}
