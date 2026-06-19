"use client";
// src/features/trails/ui/trail-visibility-button.tsx
import { useActionState } from "react";

import { Form, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { setTrailVisibility } from "../actions";
import type { Trail } from "../types";

const initial: ActionResult<Trail | null> = { success: true, data: null };

interface Props {
  id: string;
}

/**
 * Кнопка «Сделать публичным». Рендерится потребителем ТОЛЬКО для private-маршрута
 * владельца (даунгрейд UI не предлагает — бек вернул бы 422 PUBLIC_IMMUTABLE).
 */
export function TrailVisibilityButton({ id }: Props) {
  const t = useT("trails");
  const tErrors = useT("errors");
  const [state, action] = useActionState(setTrailVisibility, initial);
  return (
    <Form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visibility" value="public" />
      <SubmitButton>{t("visibilityMakePublic")}</SubmitButton>
      {!state.success && state.code === "forbidden" && (
        <span className="text-sm text-red-600">
          {tErrors("forbiddenAction", { action: t("visibilityForbiddenAction") })}
        </span>
      )}
      {!state.success && !state.code && (
        <span className="text-sm text-red-600">{state.error}</span>
      )}
    </Form>
  );
}
