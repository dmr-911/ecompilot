import { getDeps } from "@/lib/server/deps";
import { handleEstimate } from "@/lib/server/handlers";

export async function POST(request: Request) {
  return handleEstimate(request, getDeps());
}
