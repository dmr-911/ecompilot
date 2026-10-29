"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { initialState, newWorkspace, reducer, type Action, type WorkspaceState } from "@/lib/workspace/reducer";
import type { ProvidersResponse } from "@/lib/api/schemas";
import type { WorkspaceRepository } from "@/lib/storage/types";
import { LocalStorageRepository } from "@/lib/storage/local";
import { HttpWorkspaceRepository } from "@/lib/storage/http";
import { api } from "./api";

type SaveState = "idle" | "saving" | "saved" | "error" | "off";

interface Ctx {
  state: WorkspaceState;
  dispatch: Dispatch<Action>;
  providers: ProvidersResponse | null;
  providersError: string | null;
  refreshProviders: () => Promise<void>;
  repository: WorkspaceRepository | null;
  saveState: SaveState;
  saveError: string | null;
  persistence: boolean;
  setPersistence: (on: boolean) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);
const PERSIST_PREF = "listingpilot:persist";
const LAST_WS = "listingpilot:last-workspace";

function safeLocalStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem("listingpilot:probe", "1");
    s.removeItem("listingpilot:probe");
    return s;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(newWorkspace()));
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [repository, setRepository] = useState<WorkspaceRepository | null>(null);
  const [persistence, setPersistenceState] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const loaded = useRef(false);

  const refreshProviders = useCallback(async () => {
    try {
      setProviders(await api.providers());
      setProvidersError(null);
    } catch (err) {
      setProvidersError(err instanceof Error ? err.message : "Could not load provider settings.");
    }
  }, []);

  // Choose storage: server store when the operator enabled it, otherwise this browser.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let p: ProvidersResponse | null = null;
      try {
        p = await api.providers();
        if (!cancelled) setProviders(p);
      } catch (err) {
        if (!cancelled) setProvidersError(err instanceof Error ? err.message : "Could not load provider settings.");
      }
      const ls = safeLocalStorage();
      const repo: WorkspaceRepository | null = p?.storage.enabled ? new HttpWorkspaceRepository() : ls ? new LocalStorageRepository(ls) : null;
      if (cancelled) return;
      setRepository(repo);
      const pref = ls?.getItem(PERSIST_PREF);
      const on = pref === null || pref === undefined ? true : pref === "1";
      setPersistenceState(on && Boolean(repo));
      if (!repo) setSaveState("off");

      const params = new URLSearchParams(window.location.search);
      const wantDemo = params.has("demo");
      const lastId = ls?.getItem(LAST_WS);
      if (!wantDemo && on && repo && lastId) {
        const ws = await repo.load(lastId).catch(() => null);
        if (ws && !cancelled) dispatch({ type: "load", workspace: { ...ws, products: ws.products.map((x) => (x.status === "generating" || x.status === "queued" ? { ...x, status: x.generated ? "done" : "idle" } : x)) } });
      }
      loaded.current = true;
      if (wantDemo) window.dispatchEvent(new CustomEvent("listingpilot:load-demo"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPersistence = useCallback((on: boolean) => {
    setPersistenceState(on);
    safeLocalStorage()?.setItem(PERSIST_PREF, on ? "1" : "0");
    setSaveState(on ? "idle" : "off");
  }, []);

  // Debounced auto-save.
  const ws = state.workspace;
  useEffect(() => {
    if (!loaded.current || !repository || !persistence || ws.products.length === 0) return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        await repository.save(ws);
        safeLocalStorage()?.setItem(LAST_WS, ws.id);
        setSaveState("saved");
        setSaveError(null);
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : "Could not save.");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [ws, repository, persistence]);

  const value = useMemo<Ctx>(
    () => ({ state, dispatch, providers, providersError, refreshProviders, repository, saveState, saveError, persistence, setPersistence, isRunning, setIsRunning }),
    [state, providers, providersError, refreshProviders, repository, saveState, saveError, persistence, setPersistence, isRunning],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
