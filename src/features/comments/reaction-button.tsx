"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addReaction, removeReaction } from "./actions";

interface ReactionButtonProps {
  commentId: string;
  lectureId: string;
  initialCount: number;
  initialMine: boolean;
  disabled?: boolean;
}

interface ReactionState {
  count: number;
  mine: boolean;
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  commentId,
  lectureId,
  initialCount,
  initialMine,
  disabled = false,
}) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setOptimistic] = useOptimistic<ReactionState, boolean>(
    { count: initialCount, mine: initialMine },
    (prev, nextMine) => {
      if (prev.mine === nextMine) return prev;
      return {
        mine: nextMine,
        count: Math.max(0, prev.count + (nextMine ? 1 : -1)),
      };
    }
  );

  const handleClick = () => {
    if (disabled || isPending) return;
    const nextMine = !state.mine;
    setError(null);
    startTransition(async () => {
      setOptimistic(nextMine);
      const result = nextMine
        ? await addReaction({ commentId, lectureId, reaction: "like" })
        : await removeReaction({ commentId, lectureId });
      if (!result.success) {
        setError(
          result.code === "forbidden"
            ? "У вас нет прав на эту реакцию."
            : result.error
        );
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        aria-pressed={state.mine}
        aria-label={state.mine ? "Убрать лайк" : "Поставить лайк"}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
          state.mine
            ? "bg-(--color-primary)/10 border-(--color-primary) text-(--color-primary)"
            : "border-(--color-border) text-(--color-description) hover:bg-(--color-text-pane)"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span aria-hidden>♥</span>
        <span>{state.count}</span>
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
    </span>
  );
};
