"use client";

import dynamic from "next/dynamic";

/**
 * The workspace is entirely client state (browser storage, file uploads), so
 * it is rendered on the client only; the server sends a light loading shell.
 */
export const WorkspaceAppClient = dynamic(() => import("./workspace-app").then((m) => m.WorkspaceApp), {
  ssr: false,
  loading: () => <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">Loading workspace…</div>,
});
