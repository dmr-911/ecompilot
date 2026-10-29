import type { Metadata } from "next";
import { WorkspaceAppClient } from "@/components/workspace/client-only";

export const metadata: Metadata = {
  title: "Workspace · ListingPilot AI",
  description: "Import, generate, review and export product listings.",
};

export default function AppPage() {
  return <WorkspaceAppClient />;
}
