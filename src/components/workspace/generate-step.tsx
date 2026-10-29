"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Progress, Select, Textarea } from "@/components/ui";
import { useWorkspace } from "./context";
import { useGenerationRunner } from "./use-generation";
import { api } from "./api";
import { LANGUAGES, MARKETPLACE_IDS, STYLES, TONES, generationOptionsSchema, splitList, type GenerationOptions } from "@/lib/generation/options";
import { EXPORT_ADAPTERS } from "@/lib/export/registry";
import type { ProviderId } from "@/lib/ai/types";
import { hasBlockingIssues } from "@/lib/products/types";

const formSchema = z.object({
  provider: z.enum(["anthropic", "openai", "demo"]),
  model: z.string().trim().max(200),
  marketplace: z.enum(MARKETPLACE_IDS),
  language: z.string(),
  tone: z.string(),
  style: z.string(),
  faqCount: z.number({ error: "Enter a number" }).int().min(0, "0 to 8").max(8, "0 to 8"),
  prohibited: z.string().max(5000),
  required: z.string().max(5000),
  brandVoiceNotes: z.string().max(1000, "Up to 1000 characters"),
});
type FormValues = z.infer<typeof formSchema>;

const CONFIRM_ABOVE_USD = 1;
const CONFIRM_ABOVE_PRODUCTS = 50;

type Estimate = Awaited<ReturnType<typeof api.estimate>>;

function toOptions(v: FormValues): GenerationOptions {
  return generationOptionsSchema.parse({
    marketplace: v.marketplace,
    language: v.language,
    tone: v.tone,
    style: v.style,
    faqCount: v.faqCount,
    prohibitedPhrases: splitList(v.prohibited).slice(0, 50),
    requiredKeywords: splitList(v.required).slice(0, 50),
    brandVoiceNotes: v.brandVoiceNotes,
  });
}

function money(n: number | undefined) {
  if (n === undefined) return "—";
  return n < 0.01 ? "< $0.01" : `$${n.toFixed(2)}`;
}

export function GenerateStep() {
  const { state, dispatch, providers, providersError, isRunning } = useWorkspace();
  const ws = state.workspace;
  const { run, cancel, progress } = useGenerationRunner();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: ws.provider,
      model: ws.model,
      marketplace: ws.options.marketplace,
      language: ws.options.language,
      tone: ws.options.tone,
      style: ws.options.style,
      faqCount: ws.options.faqCount,
      prohibited: ws.options.prohibitedPhrases.join("\n"),
      required: ws.options.requiredKeywords.join("\n"),
      brandVoiceNotes: ws.options.brandVoiceNotes,
    },
  });
  const { register, watch, handleSubmit, formState, setValue } = form;
  const providerId = watch("provider") as ProviderId;
  const model = watch("model");
  const provider = providers?.providers.find((p) => p.id === providerId);

  const selected = useMemo(() => {
    const s = new Set(state.selection);
    return ws.products.filter((p) => s.has(p.id));
  }, [state.selection, ws.products]);
  const runnable = selected.filter((p) => !hasBlockingIssues(p));
  const skipped = selected.length - runnable.length;
  const failed = ws.products.filter((p) => p.status === "error" && !hasBlockingIssues(p));
  const maxJob = providers?.limits.maxProductsPerJob ?? 500;

  // Keep the saved workspace in sync with the form, so settings survive reloads.
  useEffect(() => {
    const sub = watch((values) => {
      const parsed = formSchema.safeParse(values);
      if (!parsed.success) return;
      dispatch({ type: "setOptions", options: toOptions(parsed.data) });
      if (parsed.data.provider !== ws.provider || parsed.data.model !== ws.model) {
        dispatch({ type: "setProvider", provider: parsed.data.provider, model: parsed.data.model });
      }
      setEstimate(null);
      setConfirmed(false);
    });
    return () => sub.unsubscribe();
  }, [watch, dispatch, ws.provider, ws.model]);

  // Pick a sensible model when the provider changes.
  useEffect(() => {
    if (!provider) return;
    const known = provider.models.some((m) => m.id === model);
    if (!model || (!provider.allowCustomModel && !known)) setValue("model", provider.defaultModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, provider]);

  async function runEstimate(values: FormValues) {
    setEstimateError(null);
    try {
      const e = await api.estimate({ provider: values.provider, model: values.model, options: toOptions(values), items: runnable.map((p) => ({ fields: p.fields })) });
      setEstimate(e);
      return e;
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : "Could not estimate usage.");
      return null;
    }
  }

  const needsKey = provider?.billable && provider.key.source === "none";
  const needsConfirm =
    estimate && estimate.billable && (runnable.length > CONFIRM_ABOVE_PRODUCTS || (estimate.costHighUsd ?? 0) > CONFIRM_ABOVE_USD || !estimate.priced);

  const start = handleSubmit(async (values) => {
    if (runnable.length > maxJob) return;
    let e = estimate;
    if (!e) e = await runEstimate(values);
    if (!e) return;
    const mustConfirm = e.billable && (runnable.length > CONFIRM_ABOVE_PRODUCTS || (e.costHighUsd ?? 0) > CONFIRM_ABOVE_USD || !e.priced);
    if (mustConfirm && !confirmed) return; // the confirmation box is now visible
    await run(
      runnable.map((p) => p.id),
      { options: toOptions(values), provider: values.provider, model: values.model },
    );
  });

  const retryFailed = handleSubmit(async (values) => {
    await run(
      failed.map((p) => p.id),
      { options: toOptions(values), provider: values.provider, model: values.model },
    );
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Generation settings" description="These apply to every selected product. Changing the marketplace re-checks existing results against its limits." />
        <form onSubmit={start} className="space-y-6 p-4 sm:p-6" noValidate>
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={isRunning}>
            <Field label="AI provider" htmlFor="provider" hint={provider && !provider.billable ? "Free template output for trying the workflow. Not AI-written." : undefined}>
              <Select id="provider" {...register("provider")}>
                {(providers?.providers ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Model" htmlFor="model" error={formState.errors.model?.message} hint={provider?.models.find((m) => m.id === model)?.note}>
              {provider && provider.models.length > 0 ? (
                <Select id="model" {...register("model")}>
                  {provider.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <Input id="model" list="model-options" placeholder={provider?.id === "openai" ? "Model ID from your provider" : undefined} {...register("model")} />
                  <datalist id="model-options">
                    {provider?.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Marketplace format" htmlFor="marketplace" hint={EXPORT_ADAPTERS[watch("marketplace")]?.description}>
              <Select id="marketplace" {...register("marketplace")}>
                {Object.values(EXPORT_ADAPTERS).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Language" htmlFor="language">
              <Select id="language" {...register("language")}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tone" htmlFor="tone" hint={TONES.find((t) => t.id === watch("tone"))?.guidance}>
              <Select id="tone" {...register("tone")}>
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Output style" htmlFor="style" hint={STYLES.find((s) => s.id === watch("style"))?.guidance}>
              <Select id="style" {...register("style")}>
                {STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="FAQs per product" htmlFor="faqCount" error={formState.errors.faqCount?.message}>
              <Input id="faqCount" type="number" min={0} max={8} {...register("faqCount", { valueAsNumber: true })} />
            </Field>
            <div />
            <Field label="Required keywords" htmlFor="required" hint="One per line or comma separated. Used only where true for the product; missing ones are flagged.">
              <Textarea id="required" rows={3} {...register("required")} />
            </Field>
            <Field label="Prohibited phrases" htmlFor="prohibited" hint="One per line. Any listing that contains one is flagged as an error.">
              <Textarea id="prohibited" rows={3} placeholder={"best\ncheap\nmiracle"} {...register("prohibited")} />
            </Field>
            <Field label="Brand voice notes (optional)" htmlFor="brandVoiceNotes" error={formState.errors.brandVoiceNotes?.message} className="sm:col-span-2">
              <Textarea id="brandVoiceNotes" rows={2} placeholder="e.g. Use British spelling. Refer to customers as 'you'." {...register("brandVoiceNotes")} />
            </Field>
          </fieldset>
        </form>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Run" />
          <div className="space-y-4 p-4 sm:p-6">
            {providersError ? <Alert tone="red">{providersError}</Alert> : null}
            <div className="text-sm text-slate-700">
              <p>
                <strong>{runnable.length}</strong> product{runnable.length === 1 ? "" : "s"} ready to generate
                {skipped ? <span className="text-amber-700"> · {skipped} skipped (data errors)</span> : null}
              </p>
              {selected.length === 0 ? (
                <p className="mt-1 text-slate-500">
                  Select products in the{" "}
                  <button type="button" className="text-indigo-700 underline" onClick={() => dispatch({ type: "goto", step: "products" })}>
                    Products
                  </button>{" "}
                  tab.
                </p>
              ) : null}
              {runnable.length > maxJob ? <p className="mt-1 text-red-700">This server allows up to {maxJob} products per job. Select fewer.</p> : null}
            </div>

            {needsKey ? (
              <Alert tone="amber" title="API key needed">
                Add your {provider?.label} key in{" "}
                <button type="button" className="underline" onClick={() => dispatch({ type: "goto", step: "settings" })}>
                  Settings
                </button>
                , or pick the demo provider. Keys are stored encrypted on the server and never sent back to the browser.
              </Alert>
            ) : null}

            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">Usage estimate</span>
                <Button size="sm" variant="ghost" disabled={runnable.length === 0 || isRunning} onClick={handleSubmit(runEstimate)}>
                  {estimate ? "Refresh" : "Estimate"}
                </Button>
              </div>
              {estimateError ? <p className="mt-2 text-red-700">{estimateError}</p> : null}
              {estimate ? (
                <dl className="mt-2 space-y-1 text-slate-700">
                  <div className="flex justify-between">
                    <dt>Input tokens (approx.)</dt>
                    <dd>{estimate.inputTokens.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Output tokens (range)</dt>
                    <dd>
                      {estimate.outputTokensLow.toLocaleString()}–{estimate.outputTokensHigh.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>Estimated provider cost</dt>
                    <dd>
                      {!estimate.billable ? "$0 (demo)" : estimate.priced ? `${money(estimate.costLowUsd)}–${money(estimate.costHighUsd)}` : "Price unknown"}
                    </dd>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <dt>Requests</dt>
                    <dd>{estimate.batches} batch(es)</dd>
                  </div>
                  {estimate.billable ? (
                    <p className="pt-1 text-xs text-slate-500">
                      {estimate.priced
                        ? "Estimate from list prices. Your provider bills actual usage to your account; prices change, so check the provider's pricing page."
                        : "No price is configured for this model, so cost cannot be estimated. Your provider will bill actual usage. Operators can set prices with MODEL_PRICING_JSON."}
                    </p>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Get a token and cost estimate before you start.</p>
              )}
            </div>

            {needsConfirm ? (
              <label className="flex items-start gap-2 text-sm text-slate-800">
                <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>
                  I understand this job sends {runnable.length} requests to {provider?.label} and my provider account will be charged for the usage.
                </span>
              </label>
            ) : null}

            {progress ? (
              <div className="space-y-2">
                <Progress value={progress.done + progress.failed} max={progress.total} label={isRunning ? `Batch ${progress.currentBatch} of ${progress.totalBatches}` : "Finished"} />
                <div className="flex gap-2 text-xs">
                  <Badge tone="green">{progress.done} done</Badge>
                  <Badge tone={progress.failed ? "red" : "neutral"}>{progress.failed} failed</Badge>
                </div>
                {progress.message ? <p className="text-xs text-slate-600">{progress.message}</p> : null}
                {progress.fatal ? <Alert tone="red">{progress.fatal}</Alert> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {isRunning ? (
                <Button variant="danger" onClick={cancel}>
                  Cancel
                </Button>
              ) : (
                <Button
                  onClick={start}
                  disabled={runnable.length === 0 || runnable.length > maxJob || Boolean(needsKey) || Boolean(needsConfirm && !confirmed)}
                >
                  Generate {runnable.length} listing{runnable.length === 1 ? "" : "s"}
                </Button>
              )}
              {failed.length > 0 && !isRunning ? (
                <Button variant="secondary" onClick={retryFailed}>
                  Retry {failed.length} failed
                </Button>
              ) : null}
              {progress && !isRunning && progress.done > 0 ? (
                <Button variant="secondary" onClick={() => dispatch({ type: "goto", step: "review" })}>
                  Review results
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
        {failed.length > 0 ? <FailedList /> : null}
      </div>
    </div>
  );
}

function FailedList() {
  const { state } = useWorkspace();
  const failed = state.workspace.products.filter((p) => p.status === "error");
  return (
    <Card>
      <CardHeader title={`Failed (${failed.length})`} description="Fix the cause, then use Retry failed." />
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto text-sm">
        {failed.map((p) => (
          <li key={p.id} className="px-4 py-2 sm:px-6">
            <p className="font-medium text-slate-900">{p.fields.name}</p>
            <p className="text-xs text-red-700">{p.error?.message}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

