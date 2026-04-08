"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";

interface TranscriptHighlighterProps {
  currentSegmentId: number | null;
  onSeek: (time: number) => void;
}

export const TranscriptHighlighter: React.FC<
  PropsWithChildren<TranscriptHighlighterProps>
> = ({ currentSegmentId, onSeek, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prev = container.querySelector("[data-active]");
    if (prev) {
      prev.removeAttribute("data-active");
    }

    if (currentSegmentId == null) return;

    const next = container.querySelector(
      `[data-segment-id="${currentSegmentId}"]`
    );
    if (next) {
      next.setAttribute("data-active", "");
      next.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSegmentId]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-start]"
    );
    if (!target) return;
    const start = Number(target.dataset.start);
    if (!Number.isNaN(start)) {
      onSeek(start);
    }
  };

  return (
    <div ref={containerRef} onClick={handleClick} className="flex flex-col gap-1 p-4">
      {children}
    </div>
  );
};
