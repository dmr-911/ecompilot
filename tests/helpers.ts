import type { GeneratedListing } from "@/lib/prompts/output-schema";
import { generationOptionsSchema, type GenerationOptionsInput } from "@/lib/generation/options";
import type { HandlerDeps } from "@/lib/server/handlers";
import { createMemoryRateLimiter } from "@/lib/server/rate-limit";
import { createDemoProvider } from "@/lib/ai/providers/demo";
import type { AppConfig } from "@/lib/server/config";

export function listing(over: Partial<GeneratedListing> = {}): GeneratedListing {
  return {
    title: "Northpeak Insulated Water Bottle 750 ml",
    shortDescription: "A 750 ml insulated bottle.",
    longDescription: "Double-wall vacuum insulation keeps drinks cold for up to 24 hours.",
    bullets: ["750 ml capacity", "Double-wall vacuum", "Keeps cold up to 24 hours", "Leak-proof screw cap", "18/8 stainless steel"],
    faqs: [{ question: "How much does it hold?", answer: "750 ml." }],
    seo: { metaTitle: "Insulated Water Bottle 750 ml", metaDescription: "750 ml insulated steel bottle.", keywords: ["water bottle"], urlSlug: "insulated-water-bottle" },
    missingInformation: [],
    ...over,
  };
}

export function options(over: GenerationOptionsInput = {}) {
  return generationOptionsSchema.parse(over);
}

export function testConfig(over: Partial<AppConfig> = {}): AppConfig {
  return {
    appSecret: "test-secret-test-secret-test-secret-1234",
    isProduction: false,
    anthropicApiKey: "",
    anthropicBaseUrl: undefined,
    openaiApiKey: "",
    openaiBaseUrl: "https://api.example.test/v1",
    openaiDefaultModel: "",
    allowUserKeys: true,
    enableDemo: true,
    maxBatchSize: 5,
    maxProductsPerJob: 100,
    concurrency: 2,
    rateLimitPerMinute: 100,
    maxUploadBytes: 1024 * 1024,
    maxOutputTokens: 4000,
    modelPricingJson: "",
    storageDriver: "none",
    storageDir: ".data/test",
    databaseUrl: "",
    storageAutoMigrate: true,
    ...over,
  };
}

export function testDeps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  const config = over.config ?? testConfig();
  return {
    config,
    providers: { demo: createDemoProvider({ delayMs: 0 }) },
    generateLimiter: createMemoryRateLimiter(config.rateLimitPerMinute, 60_000),
    importLimiter: createMemoryRateLimiter(100, 60_000),
    ...over,
  };
}

export const WATER_BOTTLE = {
  sku: "LP-1001",
  name: "Insulated Water Bottle",
  brand: "Northpeak",
  specifications: "Capacity: 750 ml; Insulation: double-wall vacuum; Keeps cold: up to 24 hours; Lid: leak-proof screw cap",
  materials: "18/8 stainless steel",
};
