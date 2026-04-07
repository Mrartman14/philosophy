// src/components/app/video/board-panel.tsx
"use client";

import { useEffect, useRef, useId } from "react";
import { BoardState } from "@/entities/video-lecture";

interface BoardPanelProps {
  boardState: BoardState | null;
}

export const BoardPanel: React.FC<BoardPanelProps> = ({ boardState }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!containerRef.current) return;

    if (!boardState || !boardState.mermaid) {
      containerRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;

    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled || !containerRef.current) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        suppressErrorRendering: true,
      });

      const elementId = `board-${uniqueId}-${boardState.id}`;

      mermaid
        .render(elementId, boardState.mermaid)
        .then(({ svg }) => {
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        })
        .catch(() => {
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = `<p class="text-sm text-(--description)">${boardState.description}</p>`;
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [boardState, uniqueId]);

  return (
    <div
      ref={containerRef}
      className="min-h-[100px] flex items-center justify-center p-4"
    />
  );
};
