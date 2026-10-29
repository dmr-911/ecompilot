import { connection } from "next/server";
import { getDeps } from "@/lib/server/deps";
import { handleListWorkspaces } from "@/lib/server/workspace-handlers";

export async function GET(request: Request) {
  await connection();
  return handleListWorkspaces(request, getDeps().store);
}
