"use client";
// src/features/comments/ui/comment-reactions.tsx
import { useState, useTransition } from "react";

import { setReaction, removeReaction } from "../actions";
import { axisLabel } from "../reactions";
import type { CommentType, MyReactions, ReactionAxis, ReactionSummary } from "../types";

interface Props {
  commentId: string;
  type: CommentType;
  reactions: ReactionSummary | undefined;
  myReactions: MyReactions | undefined;
  /** Допустимые оси для этого типа (из schema.allowed_reactions[type]). */
  allowedAxes: ReactionAxis[];
  /** Можно ли вообще реагировать (active, не свой, не удалённый). */
  canReact: boolean;
}

/** Текущее значение моей реакции по оси (number для agreement/quality, 1|undefined для insight). */
function myValue(my: MyReactions | undefined, axis: ReactionAxis): number | undefined {
  if (!my) return undefined;
  if (axis === "agreement") return my.agreement ?? undefined;
  if (axis === "quality") return my.quality ?? undefined;
  return my.insight ? 1 : undefined;
}

function axisCount(summary: ReactionSummary | undefined, axis: ReactionAxis): string {
  if (!summary) return "";
  if (axis === "insight") return summary.insight ? `★ ${summary.insight}` : "★";
  const c = axis === "agreement" ? summary.agreement : summary.quality;
  const pos = c?.positive ?? 0;
  const neg = c?.negative ?? 0;
  return `+${pos} / −${neg}`;
}

export function CommentReactions({
  commentId,
  reactions,
  myReactions,
  allowedAxes,
  canReact,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Локальное зеркало моих реакций для оптимистичного UI.
  const [my, setMy] = useState<MyReactions | undefined>(myReactions);

  if (allowedAxes.length === 0) return null;

  function toggle(axis: ReactionAxis, value: number) {
    if (!canReact || pending) return;
    setError(null);
    const current = myValue(my, axis);
    const isSame = current === value;
    // Оптимистично. При снятии — пересобираем объект без ключа (exactOptionalPropertyTypes:
    // нельзя присваивать undefined в optional number-поле, поэтому не delete).
    if (axis === "insight") {
      setMy({ ...my, insight: !isSame });
    } else if (isSame) {
      // Rebuild without the axis key to satisfy exactOptionalPropertyTypes.
      const next: MyReactions = {};
      if (my?.insight !== undefined) next.insight = my.insight;
      if (axis !== "agreement" && my?.agreement !== undefined) next.agreement = my.agreement;
      if (axis !== "quality" && my?.quality !== undefined) next.quality = my.quality;
      setMy(next);
    } else {
      setMy({ ...my, [axis]: value });
    }

    startTransition(async () => {
      const result = isSame
        ? await removeReaction({ id: commentId, axis })
        : await setReaction({ id: commentId, axis, value });
      if (!result.success) {
        setMy(myReactions); // откат
        setError(
          result.code === "forbidden"
            ? "У вас нет прав на реакцию."
            : result.error,
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {allowedAxes.map((axis) => {
          const current = myValue(my, axis);
          const values = axis === "insight" ? [1] : [1, -1];
          return (
            <span key={axis} className="flex items-center gap-1">
              <span className="text-(--color-description)">{axisLabel(axis)}:</span>
              {values.map((v) => {
                const active = current === v;
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={!canReact || pending}
                    onClick={() => { toggle(axis, v); }}
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded border border-(--color-border) bg-(--color-text-pane) px-1.5"
                        : "rounded border border-(--color-border) px-1.5 hover:bg-(--color-text-pane) disabled:opacity-40"
                    }
                  >
                    {axis === "insight" ? "★" : v === 1 ? "+" : "−"}
                  </button>
                );
              })}
              <span className="text-(--color-description)">{axisCount(reactions, axis)}</span>
            </span>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
