"use client";
// src/features/comments/ui/comment-reactions.tsx
import { useState, useOptimistic, startTransition } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import { setReaction, removeReaction } from "../actions";
import { axisLabel, axisValueAriaLabel } from "../reactions";
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

export interface ReactionPatch {
  axis: ReactionAxis;
  value: number;
  isSame: boolean;
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

/** Apply a reaction patch to the current MyReactions state, respecting exactOptionalPropertyTypes. */
export function applyReactionPatch(state: MyReactions | undefined, patch: ReactionPatch): MyReactions {
  const { axis, value, isSame } = patch;
  if (axis === "insight") {
    const next: MyReactions = {};
    // Rebuild without spreading undefined — exactOptionalPropertyTypes requires explicit keys.
    if (state?.agreement !== undefined) next.agreement = state.agreement;
    if (state?.quality !== undefined) next.quality = state.quality;
    next.insight = !isSame;
    return next;
  }
  if (isSame) {
    // Remove the axis key entirely (no undefined spread).
    const next: MyReactions = {};
    if (state?.insight !== undefined) next.insight = state.insight;
    if (axis !== "agreement" && state?.agreement !== undefined) next.agreement = state.agreement;
    if (axis !== "quality" && state?.quality !== undefined) next.quality = state.quality;
    return next;
  }
  // Set new value for the axis.
  const next: MyReactions = {};
  if (state?.insight !== undefined) next.insight = state.insight;
  if (axis === "agreement") {
    next.agreement = value;
    if (state?.quality !== undefined) next.quality = state.quality;
  } else {
    if (state?.agreement !== undefined) next.agreement = state.agreement;
    next.quality = value;
  }
  return next;
}

export function CommentReactions({
  commentId,
  reactions,
  myReactions,
  allowedAxes,
  canReact,
}: Props) {
  const t = useT("comments");
  const [error, setError] = useState<string | null>(null);
  const [optimisticReactions, applyOptimistic] = useOptimistic(
    myReactions,
    (state: MyReactions | undefined, patch: ReactionPatch) => applyReactionPatch(state, patch),
  );

  if (allowedAxes.length === 0) return null;

  function toggle(axis: ReactionAxis, value: number) {
    // Only gate on canReact — NOT on pending — so a second axis can be toggled while the first is in flight.
    if (!canReact) return;
    setError(null);
    const current = myValue(optimisticReactions, axis);
    const isSame = current === value;
    const patch: ReactionPatch = { axis, value, isSame };

    startTransition(async () => {
      applyOptimistic(patch);
      const result = isSame
        ? await removeReaction({ id: commentId, axis })
        : await setReaction({ id: commentId, axis, value });
      if (!result.success) {
        // useOptimistic reverts automatically when the transition settles — no manual rollback needed.
        setError(
          result.code === "forbidden"
            ? t("reactionForbidden")
            : result.error,
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {allowedAxes.map((axis) => {
          const current = myValue(optimisticReactions, axis);
          const values = axis === "insight" ? [1] : [1, -1];
          return (
            <span key={axis} className="flex items-center gap-1">
              <span className="text-(--color-fg-muted)">{axisLabel(axis)}:</span>
              {values.map((v) => {
                const active = current === v;
                return (
                  <Button
                    key={v}
                    variant="ghost"
                    size="sm"
                    disabled={!canReact}
                    onClick={() => { toggle(axis, v); }}
                    aria-pressed={active}
                    aria-label={`${axisLabel(axis)}: ${axisValueAriaLabel(axis, v)}`}
                    className={
                      active
                        ? "h-auto border border-(--color-border) bg-(--color-surface-subtle) px-1.5 disabled:opacity-40"
                        : "h-auto border border-(--color-border) px-1.5 disabled:opacity-40"
                    }
                  >
                    <span aria-hidden="true">{axis === "insight" ? "★" : v === 1 ? "+" : "−"}</span>
                  </Button>
                );
              })}
              <span className="text-(--color-fg-muted)">{axisCount(reactions, axis)}</span>
            </span>
          );
        })}
      </div>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
    </div>
  );
}
