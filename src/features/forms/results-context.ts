// src/features/forms/results-context.ts
import "server-only";
import { forbidden, notFound } from "next/navigation";

import { getMe, type MaybeMe } from "@/utils/me";

import { getFormById } from "./api";
import { canViewFormResults } from "./permissions";
import type { Form } from "./types";

/**
 * Единый авторизационный гейт поверхности результатов формы, общий для
 * `/forms/[id]/results` и `/forms/[id]/fields/[fieldId]`. Держит периметр в
 * одной точке: невидимая форма → 404 (как сам ресурс), видимая форма с
 * закрытыми результатами → 403. После него вызывающий тянет stats/answers.
 * token (?token=) пробрасывается в getFormById (share-link на приватную форму).
 */
export async function loadFormResultsContext(
  id: string,
  token?: string,
): Promise<{ me: MaybeMe; form: Form }> {
  const [me, form] = await Promise.all([getMe(), getFormById(id, token)]);
  if (!form) notFound();
  if (!canViewFormResults(me, form)) forbidden();
  return { me, form };
}
