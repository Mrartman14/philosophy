"use client";
// src/features/documents/ui/document-visibility-button.tsx
import { useActionState } from "react";

import { Form, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { setDocumentVisibility } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

interface Props {
  id: string;
}

/**
 * Кнопка «Сделать публичным». Рендерится потребителем ТОЛЬКО для private-документа
 * владельца (даунгрейд UI не предлагает — бек вернул бы 422 PUBLIC_IMMUTABLE).
 */
export function DocumentVisibilityButton({ id }: Props) {
  const t = useT("documents");
  const tErrors = useT("errors");
  const [state, action] = useActionState(setDocumentVisibility, initial);
  return (
    <Form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visibility" value="public" />
      <SubmitButton>{t("makePublicButton")}</SubmitButton>
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
