import { z } from "zod";
import { PRODUCT_FIELD_KEYS } from "../products/fields";
import { generationOptionsSchema } from "../generation/options";
import { PROVIDER_IDS } from "../ai/registry";

const fieldValue = z.string().max(20000);
export const rawFieldsSchema = z.partialRecord(z.enum(PRODUCT_FIELD_KEYS), fieldValue);

export const providerIdSchema = z.enum(PROVIDER_IDS);

export const generateRequestSchema = z.object({
  provider: providerIdSchema,
  model: z.string().trim().max(200).default(""),
  options: generationOptionsSchema,
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        fields: rawFieldsSchema,
      }),
    )
    .min(1, "Select at least one product"),
});
export type GenerateRequest = z.input<typeof generateRequestSchema>;

export const estimateRequestSchema = z.object({
  provider: providerIdSchema,
  model: z.string().trim().max(200).default(""),
  options: generationOptionsSchema,
  items: z.array(z.object({ fields: rawFieldsSchema })).min(1),
});
export type EstimateRequest = z.input<typeof estimateRequestSchema>;

export const saveKeyRequestSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z
    .string()
    .trim()
    .min(10, "That does not look like an API key")
    .max(400, "That does not look like an API key")
    .regex(/^\S+$/, "API keys cannot contain spaces"),
});

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown; retryAfterMs?: number };
}

export interface ProvidersResponse {
  providers: {
    id: "anthropic" | "openai" | "demo";
    label: string;
    billable: boolean;
    defaultModel: string;
    allowCustomModel: boolean;
    models: { id: string; label: string; priced: boolean; note?: string }[];
    key: { source: "user" | "server" | "none"; masked?: string };
  }[];
  limits: { maxBatchSize: number; maxProductsPerJob: number; maxUploadBytes: number; rateLimitPerMinute: number };
  allowUserKeys: boolean;
  storage: { enabled: boolean; driver: string };
}
