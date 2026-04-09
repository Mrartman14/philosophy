"use client";

import { useState, useTransition } from "react";
import { deleteLecture } from "@/features/admin/actions";

interface LectureDeleteButtonProps {
  lectureId: string;
  lectureTitle: string;
}

export const LectureDeleteButton: React.FC<LectureDeleteButtonProps> = ({
  lectureId,
  lectureTitle,
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!confirm(`Удалить лекцию «${lectureTitle}»?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteLecture({ id: lectureId });
      if (!result.success) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="px-2 py-1 text-xs border border-red-500 text-red-500 rounded disabled:opacity-50"
      >
        {pending ? "..." : "Удалить"}
      </button>
      {error && (
        <span className="text-xs text-red-500" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
