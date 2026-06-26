"use client";
// src/features/comments/ui/open-thread-button.tsx
// Скроллит к корневому комментарию в нижнем треде (#comment-<id>). Узел треда
// несёт id=comment-<id> (см. comment-tree.tsx, Task 8). Уважает ось appearance
// motion (reduced → без анимации), как ast-toc.tsx — иначе регрессия reduced-motion.
import { useReducedMotion } from "@/components/appearance";
import { Button } from "@/components/ui";

export function OpenThreadButton({ commentId, label }: { commentId: string; label: string }) {
  const reduced = useReducedMotion();
  return (
    <Button
      type="button"
      compact
      tone="quiet"
      onClick={() => {
        const el = document.getElementById(`comment-${commentId}`);
        el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      }}
    >
      {label}
    </Button>
  );
}
