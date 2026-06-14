// src/features/comments/ui/comment-reaction-summary.tsx
// Чистая read-only сводка реакций (изоморфно, без интерактива/actions/схемы).
// Презентационный двойник интерактивного CommentReactions для офлайн-рендера.
import { REACTION_AXES, axisLabel } from "../reactions";
import type { ReactionAxis, ReactionSummary } from "../types";

function axisCount(summary: ReactionSummary, axis: ReactionAxis): string {
  if (axis === "insight") return summary.insight ? `★ ${summary.insight}` : "★";
  const c = axis === "agreement" ? summary.agreement : summary.quality;
  const pos = c?.positive ?? 0;
  const neg = c?.negative ?? 0;
  return `+${pos} / −${neg}`;
}

function hasData(summary: ReactionSummary, axis: ReactionAxis): boolean {
  if (axis === "insight") return (summary.insight ?? 0) > 0;
  const c = axis === "agreement" ? summary.agreement : summary.quality;
  return (c?.positive ?? 0) > 0 || (c?.negative ?? 0) > 0;
}

export function CommentReactionSummary({
  reactions,
}: {
  reactions: ReactionSummary | undefined;
}) {
  if (!reactions) return null;
  const axes = REACTION_AXES.filter((a) => hasData(reactions, a));
  if (axes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-description)">
      {axes.map((axis) => (
        <span key={axis} className="flex items-center gap-1">
          <span>{axisLabel(axis)}:</span>
          <span>{axisCount(reactions, axis)}</span>
        </span>
      ))}
    </div>
  );
}
