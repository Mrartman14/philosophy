"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createApiClient } from "@/api/client";
import { loadSchema } from "./schema-cache";
import type { SchemaSnapshot, SchemaResponse } from "./types";

const SchemaContext = createContext<SchemaSnapshot | null>(null);

async function defaultFetcher(): Promise<SchemaResponse> {
  const api = await createApiClient();
  const { data } = await api.GET("/api/ast/schema");
  if (!data) throw new Error("schema fetch failed");
  return data;
}

interface ProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Test seam — overrides the default api fetcher. */
  fetcher?: () => Promise<SchemaResponse>;
}

export function SchemaContextProvider({
  children,
  fallback = null,
  fetcher = defaultFetcher,
}: ProviderProps) {
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSchema(fetcher)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  if (error) {
    return <div role="alert">AST schema недоступна: {error.message}</div>;
  }
  if (!snapshot) return <>{fallback}</>;
  return <SchemaContext.Provider value={snapshot}>{children}</SchemaContext.Provider>;
}

export function useSchema(): SchemaSnapshot {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("useSchema must be used inside <SchemaContextProvider>");
  return ctx;
}
