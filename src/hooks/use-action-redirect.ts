"use client";
// src/hooks/use-action-redirect.ts
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import type { ActionResult } from "@/utils/create-action";

/**
 * Редирект после успешного create-экшена. Когда `state` переходит в success с
 * непустыми данными — пушит на URL, вычисленный из data. Заменяет копипасту
 * `useEffect(() => { if (state.success && state.data?.id) router.push(...) })`
 * в create-формах.
 *
 * `getUrl` держим в ref (обновляем в отдельном эффекте, не в рендере) → эффект
 * редиректа зависит только от `[state, router]`, как в исходных формах: переход
 * в success триггерит push один раз, а не на каждый ре-рендер из-за нестабильной
 * inline-функции.
 */
export function useActionRedirect<T>(
  state: ActionResult<T>,
  getUrl: (data: NonNullable<T>) => string,
): void {
  const router = useRouter();
  const getUrlRef = useRef(getUrl);

  useEffect(() => {
    getUrlRef.current = getUrl;
  });

  useEffect(() => {
    if (state.success && state.data != null) {
      router.push(getUrlRef.current(state.data));
    }
  }, [state, router]);
}
