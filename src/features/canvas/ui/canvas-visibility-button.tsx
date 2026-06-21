"use client";
// src/features/canvas/ui/canvas-visibility-button.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button, Form, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { setCanvasVisibility } from "../actions";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

interface Props {
  id: string;
}

/** Кнопка «Сделать публичным» (private→public, необратимо). */
export function CanvasVisibilityButton({ id }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("canvas");
  const tErrors = useT("errors");
  const [state, action] = useActionState(setCanvasVisibility, initial);

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: t("visibilityButton.toastPublishedTitle") });
      router.refresh();
    } else if (!state.success) {
      const msg =
        state.code === "forbidden"
          ? tErrors("forbiddenAction", { action: t("visibilityForbiddenAction") })
          : state.error;
      toast.add({ title: t("visibilityButton.toastErrorTitle"), description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visibility" value="public" />
      <Button type="submit" variant="secondary">{t("visibilityButton.makePublic")}</Button>
    </Form>
  );
}
