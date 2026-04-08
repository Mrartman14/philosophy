"use client";

import { useEffect, useRef } from "react";
import type { components } from "@/api/schema";

type Segment = components["schemas"]["transcript.Segment"];

interface TranscriptPanelProps {
  segments: Segment[];
  currentSegmentId: number | null;
  onSeek: (time: number) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  segments,
  currentSegmentId,
  onSeek,
}) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSegmentId]);

  return (
    <div className="flex flex-col gap-1 p-4">
      {segments.map((item) => {
        const isActive = item.id === currentSegmentId;
        return (
          <button
            key={item.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(item.start)}
            className={`text-left p-2 rounded-lg transition-colors cursor-pointer ${
              isActive
                ? "bg-(--color-primary)/10 border-l-2 border-(--color-primary)"
                : "hover:bg-(--color-border)/30"
            }`}
          >
            <span className="text-xs text-(--description) block">
              {item.speaker}
            </span>
            <span className="text-sm">{item.text}</span>
          </button>
        );
      })}
    </div>
  );
};
