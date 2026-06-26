"use client";
// src/features/comments/ui/open-thread-button.tsx
// Скроллит к корневому комментарию в нижнем треде (#comment-<id>). Узел треда
// несёт id=comment-<id> (см. comment-tree.tsx). Скролл + reduced-motion
// инкапсулированы в общем хуке useScrollToCommentThread (thread-scroll.ts).
import { Button } from "@/components/ui";

import { useScrollToCommentThread } from "../thread-scroll";

export function OpenThreadButton({ commentId, label }: { commentId: string; label: string }) {
  const scroll = useScrollToCommentThread();
  return (
    <Button
      type="button"
      compact
      tone="quiet"
      onClick={() => {
        scroll(commentId);
      }}
    >
      {label}
    </Button>
  );
}
