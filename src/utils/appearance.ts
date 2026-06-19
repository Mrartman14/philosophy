import "server-only";

import { cookies } from "next/headers";

import { APPEARANCE_COOKIE, parseAppearance, type Appearance } from "@/components/appearance/appearance-cookie";

export async function getAppearance(): Promise<Appearance> {
  const store = await cookies();
  return parseAppearance(store.get(APPEARANCE_COOKIE)?.value);
}
// Reconcile-on-load (бэк авторитетен на свежей сессии) — добавляется в Task 21,
// когда появится бэк-контракт appearance. Пока cookie самодостаточен.
