"use client";
// src/features/documents/ui/document-visibility-button.tsx
import { useActionState } from "react";

import { Form, FormFeedback, Inline, SubmitButton } from "@/components/ui";
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
  const [state, action] = useActionState(setDocumentVisibility, initial);
  return (
    <Form action={action}>
      <Inline align="center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="visibility" value="public" />
        <SubmitButton>{t("makePublicButton")}</SubmitButton>
        <FormFeedback
          result={state}
          forbiddenAction={t("visibilityForbiddenAction")}
        />
      </Inline>
    </Form>
  );
}
