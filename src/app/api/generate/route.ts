import { getDeps } from "@/lib/server/deps";
import { handleGenerate } from "@/lib/server/handlers";

/** Generation can take a while for a batch; allow up to 5 minutes where the host supports it. */
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleGenerate(request, getDeps());
}
