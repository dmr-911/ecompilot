"use client";

import { useCallback, useRef, useState } from "react";
import { useWorkspace } from "./context";
import { api, ApiError } from "./api";
import { chunk } from "@/lib/generation/batching";
import type { Workspace } from "@/lib/storage/types";

export interface RunProgress {
  total: number;
  done: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  message?: string;
  fatal?: string;
}

const MAX_SERVER_RETRIES = 4;

/**
 * Splits a job into server-sized batches and sends them one after another,
 * waiting out server rate limits. Each batch's results are applied as they
 * arrive, so progress is visible and finished work is saved even if the job
 * is cancelled.
 */
export function useGenerationRunner() {
  const { state, dispatch, providers, setIsRunning } = useWorkspace();
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const run = useCallback(
    async (ids: string[], overrides: Partial<Pick<Workspace, "options" | "provider" | "model">> = {}) => {
      const ws = { ...state.workspace, ...overrides };
      const byId = new Map(ws.products.map((p) => [p.id, p]));
      const items = ids
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ id: p.id, fields: p.fields }));
      if (items.length === 0) return;

      const batchSize = providers?.limits.maxBatchSize ?? 10;
      const batches = chunk(items, batchSize);
      const controller = new AbortController();
      abortRef.current = controller;
      setIsRunning(true);
      dispatch({ type: "markQueued", ids: items.map((i) => i.id) });
      let done = 0;
      let failed = 0;
      setProgress({ total: items.length, done, failed, currentBatch: 0, totalBatches: batches.length });

      try {
        for (let b = 0; b < batches.length; b++) {
          const batch = batches[b];
          dispatch({ type: "markGenerating", ids: batch.map((i) => i.id) });
          setProgress((p) => p && { ...p, currentBatch: b + 1, message: undefined });

          let attempt = 0;
          while (true) {
            try {
              const res = await api.generate({ provider: ws.provider, model: ws.model, options: ws.options, items: batch }, controller.signal);
              dispatch({ type: "applyResults", results: res.results });
              done += res.results.filter((r) => r.ok).length;
              failed += res.results.filter((r) => !r.ok).length;
              setProgress((p) => p && { ...p, done, failed });
              const fatal = res.results.find((r) => !r.ok && !r.error.retryable && ["invalid_api_key", "quota_exceeded", "permission_denied", "model_not_found"].includes(r.error.kind));
              if (fatal && !fatal.ok) {
                const rest = batches.slice(b + 1).flat().map((i) => i.id);
                if (rest.length) dispatch({ type: "markFailed", ids: rest, kind: fatal.error.kind, message: fatal.error.message, retryable: false });
                failed += rest.length;
                setProgress((p) => p && { ...p, failed, fatal: fatal.error.message });
                return;
              }
              break;
            } catch (err) {
              if (controller.signal.aborted) throw err;
              if (err instanceof ApiError && err.status === 429 && attempt < MAX_SERVER_RETRIES) {
                attempt++;
                const wait = Math.min(60_000, err.retryAfterMs ?? 5000 * attempt);
                setProgress((p) => p && { ...p, message: `Rate limit reached. Waiting ${Math.ceil(wait / 1000)}s before retrying…` });
                await new Promise((r) => setTimeout(r, wait));
                continue;
              }
              const message = err instanceof Error ? err.message : "Generation failed.";
              const ids = batches.slice(b).flat().map((i) => i.id);
              const retryable = !(err instanceof ApiError) || err.status >= 500 || err.status === 429 || err.status === 0;
              dispatch({ type: "markFailed", ids, kind: retryable ? "provider_unavailable" : "validation", message, retryable });
              failed += ids.length;
              setProgress((p) => p && { ...p, failed, fatal: message });
              return;
            }
          }
        }
      } catch {
        // Cancelled: anything not finished goes back to its previous state.
        dispatch({ type: "resetInFlight" });
        setProgress((p) => p && { ...p, message: "Cancelled. Finished products were kept." });
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [state.workspace, providers, dispatch, setIsRunning],
  );

  return { run, cancel, progress, clearProgress: () => setProgress(null) };
}
