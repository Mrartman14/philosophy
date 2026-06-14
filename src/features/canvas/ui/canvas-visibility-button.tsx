"use client";
// src/features/canvas/ui/canvas-visibility-button.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button, useToast } from "@/components/ui";
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
  const [state, action] = useActionState(setCanvasVisibility, initial);

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: "Канвас опубликован" });
      router.refresh();
    } else if (!state.success) {
      const msg = state.code === "forbidden" ? "У вас нет прав на это действие." : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visibility" value="public" />
      <Button type="submit" variant="secondary">Сделать публичным</Button>
    </form>
  );
}
