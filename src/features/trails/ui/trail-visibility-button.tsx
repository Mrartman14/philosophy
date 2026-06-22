"use client";
// src/features/trails/ui/trail-visibility-button.tsx
import { useActionState } from "react";

import { Form, FormFeedback, Inline, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { setTrailVisibility } from "../actions";
import type { Trail } from "../types";

const initial = initialActionState<Trail | null>(null);

interface Props {
  id: string;
}

/**
 * Кнопка «Сделать публичным». Рендерится потребителем ТОЛЬКО для private-маршрута
 * владельца (даунгрейд UI не предлагает — бек вернул бы 422 PUBLIC_IMMUTABLE).
 */
export function TrailVisibilityButton({ id }: Props) {
  const t = useT("trails");
  const [state, action] = useActionState(setTrailVisibility, initial);
  return (
    <Form action={action}>
      <Inline align="center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="visibility" value="public" />
        <SubmitButton>{t("visibilityMakePublic")}</SubmitButton>
        <FormFeedback result={state} forbiddenAction={t("visibilityForbiddenAction")} />
      </Inline>
    </Form>
  );
}
