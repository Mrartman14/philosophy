"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Returns a `navigate(params, baseOverride?)` that router.replace's into the
 * (optionally overridden) path with the given query, inside a transition, plus
 * `pending`. The CALLER owns building `params` (fields / sentinels / offset
 * policy).
 */
export function useQueryFormSubmit() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function navigate(params: URLSearchParams, baseOverride?: string) {
    const base = baseOverride ?? pathname;
    const qs = params.toString();
    startTransition(() => { router.replace(qs ? `${base}?${qs}` : base); });
  }

  return { navigate, pending };
}
