import { getDeps } from "@/lib/server/deps";
import { handleDeleteKey, handleSaveKey } from "@/lib/server/handlers";

export async function POST(request: Request) {
  return handleSaveKey(request, getDeps());
}

export async function DELETE(request: Request) {
  return handleDeleteKey(request, getDeps());
}
