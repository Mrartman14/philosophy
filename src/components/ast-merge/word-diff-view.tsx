import type { DiffToken } from "./types";

/** Рендер пословного diff: add — зелёным, del — красным зачёркнутым. */
export function WordDiffView({ tokens }: { tokens: DiffToken[] }) {
  return (
    <p className="whitespace-pre-wrap text-sm">
      {tokens.map((tok, i) => {
        if (tok.type === "add") {
          return (
            <span
              key={i}
              className="rounded-sm bg-(--color-success-bg) text-(--color-success-fg)"
            >
              {tok.text}
            </span>
          );
        }
        if (tok.type === "del") {
          return (
            <span
              key={i}
              className="rounded-sm bg-(--color-danger-bg) text-(--color-danger-fg) line-through"
            >
              {tok.text}
            </span>
          );
        }
        return <span key={i}>{tok.text}</span>;
      })}
    </p>
  );
}
