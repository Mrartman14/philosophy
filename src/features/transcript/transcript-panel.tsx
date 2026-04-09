import type { Segment } from "@/api/types";

interface TranscriptPanelProps {
  segments: Segment[];
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  segments,
}) => {
  return (
    <>
      {segments.map((item, index) => (
        <button
          key={item.id ?? index}
          data-segment-id={item.id}
          data-start={item.start ?? 0}
          className="text-left p-2 rounded-lg transition-colors cursor-pointer hover:bg-(--color-border)/30 data-[active]:bg-(--color-primary)/10 data-[active]:border-l-2 data-[active]:border-(--color-primary) data-[active]:hover:bg-(--color-primary)/10"
        >
          <span className="text-xs text-(--color-description) block">
            {item.speaker}
          </span>
          <span className="text-sm">{item.text}</span>
        </button>
      ))}
    </>
  );
};
