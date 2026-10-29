import { connection } from "next/server";
import { getDeps } from "@/lib/server/deps";
import { handleProviders } from "@/lib/server/handlers";

export async function GET(request: Request) {
  await connection();
  return handleProviders(request, getDeps());
}
