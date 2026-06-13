"use client";
// src/features/canvas/ui/canvas-delete-button.tsx
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { deleteCanvas } from "../actions";

interface Props {
  id: string;
}

/** Удаление канваса с подтверждением. После успеха → редирект на /canvases. */
export function CanvasDeleteButton({ id }: Props) {
  const router = useRouter();
  const toast = useToast();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить канвас?"
      description="Действие необратимо."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteCanvas(id);
        if (result.success) {
          toast.add({ title: "Канвас удалён" });
          router.push("/canvases");
        } else {
          const msg = result.code === "forbidden" ? "У вас нет прав на удаление канваса." : result.error;
          toast.add({ title: "Ошибка", description: msg });
        }
      }}
    />
  );
}
