import { z } from "zod";
import type { ProductRecord } from "../products/types";
import type { GenerationOptions } from "../generation/options";
import type { ColumnMapping } from "../csv/mapping";
import type { ProviderId } from "../ai/types";

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fileName?: string;
  headers: string[];
  mapping: ColumnMapping;
  products: ProductRecord[];
  options: GenerationOptions;
  provider: ProviderId;
  model: string;
  isDemo: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  updatedAt: number;
  productCount: number;
  generatedCount: number;
}

/**
 * Persistence boundary. The UI only talks to this interface, so a database
 * (Postgres, SQLite, DynamoDB...) is added by writing one more implementation.
 */
export interface WorkspaceRepository {
  readonly kind: string;
  list(): Promise<WorkspaceSummary[]>;
  load(id: string): Promise<Workspace | null>;
  save(workspace: Workspace): Promise<void>;
  remove(id: string): Promise<void>;
}

export function summarizeWorkspace(w: Workspace): WorkspaceSummary {
  return {
    id: w.id,
    name: w.name,
    updatedAt: w.updatedAt,
    productCount: w.products.length,
    generatedCount: w.products.filter((p) => p.generated).length,
  };
}

/** Loose structural check for data coming back from storage. */
export const workspaceShapeSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().max(200),
    createdAt: z.number(),
    updatedAt: z.number(),
    headers: z.array(z.string()),
    mapping: z.record(z.string(), z.string().nullable()),
    products: z.array(z.object({ id: z.string(), fields: z.record(z.string(), z.string()) }).passthrough()).max(10000),
    options: z.object({}).passthrough(),
    provider: z.string(),
    model: z.string(),
    isDemo: z.boolean(),
  })
  .passthrough();
