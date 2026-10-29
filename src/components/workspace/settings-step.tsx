"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Badge, Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { useWorkspace } from "./context";
import { api } from "./api";
import { saveKeyRequestSchema } from "@/lib/api/schemas";
import type { z } from "zod";

type KeyForm = z.input<typeof saveKeyRequestSchema>;

function KeyCard({ provider, label, help }: { provider: "anthropic" | "openai"; label: string; help: React.ReactNode }) {
  const { providers, refreshProviders } = useWorkspace();
  const info = providers?.providers.find((p) => p.id === provider);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const form = useForm<KeyForm>({ resolver: zodResolver(saveKeyRequestSchema), defaultValues: { provider, apiKey: "" } });

  const submit = form.handleSubmit(async (values) => {
    setMessage(null);
    try {
      const r = await api.saveKey(provider, values.apiKey);
      form.reset({ provider, apiKey: "" });
      setMessage({ tone: "green", text: `Saved (${r.masked}).` });
      await refreshProviders();
    } catch (err) {
      setMessage({ tone: "red", text: err instanceof Error ? err.message : "Could not save the key." });
    }
  });

  async function remove() {
    await api.deleteKey(provider).catch(() => undefined);
    setMessage({ tone: "green", text: "Key removed." });
    await refreshProviders();
  }

  if (!info) return null;
  return (
    <Card>
      <CardHeader
        title={label}
        description={help}
        actions={
          info.key.source === "user" ? (
            <Badge tone="green">Your key {info.key.masked}</Badge>
          ) : info.key.source === "server" ? (
            <Badge tone="blue">Using server key</Badge>
          ) : (
            <Badge tone="neutral">No key</Badge>
          )
        }
      />
      <form onSubmit={submit} className="space-y-3 p-4 sm:p-6" noValidate>
        {providers?.allowUserKeys ? (
          <>
            <Field label="API key" htmlFor={`key-${provider}`} error={form.formState.errors.apiKey?.message} hint="Sent once over HTTPS, stored encrypted in an httpOnly cookie, and never readable by browser code.">
              <Input id={`key-${provider}`} type="password" autoComplete="off" spellCheck={false} placeholder={info.key.source === "user" ? "Enter a new key to replace the saved one" : "Paste your key"} {...form.register("apiKey")} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Save key
              </Button>
              {info.key.source === "user" ? (
                <Button variant="danger" onClick={remove}>
                  Remove key
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">This installation uses a server-configured key; customer keys are disabled.</p>
        )}
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      </form>
    </Card>
  );
}

export function SettingsStep() {
  const { providers, repository, persistence, setPersistence, saveState, saveError } = useWorkspace();
  return (
    <div className="space-y-6">
      <Alert tone="blue" title="You pay your AI provider directly">
        Generation runs on your own provider account. The provider bills you for every request, including retries. Use the demo provider to try the workflow at no cost.
      </Alert>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <KeyCard
          provider="anthropic"
          label="Anthropic (Claude)"
          help={
            <>
              Create a key in the{" "}
              <a className="text-indigo-700 underline" href="https://platform.claude.com" target="_blank" rel="noreferrer">
                Claude Console
              </a>
              .
            </>
          }
        />
        <KeyCard provider="openai" label="OpenAI-compatible" help="Works with OpenAI and other APIs that implement Chat Completions with JSON-schema output. The server operator sets the base URL." />
      </div>
      <Card>
        <CardHeader title="Saving your work" />
        <div className="space-y-3 p-4 text-sm sm:p-6">
          {repository ? (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={persistence} onChange={(e) => setPersistence(e.target.checked)} />
                Save workspaces automatically ({repository.kind === "server" ? "on the server" : "in this browser"})
              </label>
              <p className="text-slate-600">
                {repository.kind === "server"
                  ? "Workspaces are stored in the server database and tied to this browser by an anonymous cookie."
                  : "Workspaces are stored in this browser only. Clearing site data deletes them. Your operator can enable server storage (Neon Postgres) by setting DATABASE_URL."}
              </p>
              {saveState === "error" ? <Alert tone="red">{saveError}</Alert> : null}
            </>
          ) : (
            <p className="text-slate-600">Storage is not available in this browser (private mode?). Export your work before closing the tab.</p>
          )}
        </div>
      </Card>
      {providers ? (
        <Card>
          <CardHeader title="Server limits" />
          <dl className="grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4 sm:p-6">
            <div>
              <dt className="text-slate-500">Products per request</dt>
              <dd className="font-medium">{providers.limits.maxBatchSize}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Products per job</dt>
              <dd className="font-medium">{providers.limits.maxProductsPerJob}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Requests per minute</dt>
              <dd className="font-medium">{providers.limits.rateLimitPerMinute}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Max upload</dt>
              <dd className="font-medium">{Math.round(providers.limits.maxUploadBytes / 1024 / 1024)} MB</dd>
            </div>
          </dl>
        </Card>
      ) : null}
    </div>
  );
}
