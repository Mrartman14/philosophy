"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { getAstSchemaAction } from "./schema-action";
import { loadSchema, normalizeSchema } from "./schema-cache";
import type { SchemaSnapshot, SchemaResponse } from "./types";

const SchemaContext = createContext<SchemaSnapshot | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /**
   * Серверно-загруженная схема (предпочтительный путь). Когда передана —
   * контекст гидрируется синхронно из неё, клиентского фетча нет.
   */
  initial?: SchemaResponse | undefined;
  /**
   * Фетчер для чисто-клиентских маунтов (диалоги без серверного родителя) и
   * тест-шов. По умолчанию — server action getAstSchemaAction: даже без
   * `initial` запрос уходит через сервер, а не браузер→бек.
   */
  fetcher?: () => Promise<SchemaResponse>;
}

export function SchemaContextProvider({
  children,
  fallback = null,
  initial,
  fetcher = getAstSchemaAction,
}: ProviderProps) {
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(() =>
    initial ? normalizeSchema(initial) : null,
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (initial) return; // уже гидрировано из серверного пропа
    let cancelled = false;
    loadSchema(fetcher)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [initial, fetcher]);

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
