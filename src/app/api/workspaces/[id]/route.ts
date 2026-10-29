import { getDeps } from "@/lib/server/deps";
import { handleDeleteWorkspace, handleGetWorkspace, handlePutWorkspace } from "@/lib/server/workspace-handlers";

export async function GET(request: Request, ctx: RouteContext<"/api/workspaces/[id]">) {
  const { id } = await ctx.params;
  return handleGetWorkspace(request, getDeps().store, id);
}

export async function PUT(request: Request, ctx: RouteContext<"/api/workspaces/[id]">) {
  const { id } = await ctx.params;
  return handlePutWorkspace(request, getDeps().store, id);
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/workspaces/[id]">) {
  const { id } = await ctx.params;
  return handleDeleteWorkspace(request, getDeps().store, id);
}
