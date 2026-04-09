import type { Segment } from "@/api/types";

interface TranscriptPanelProps {
  segments: Segment[];
  annotatedPositions?: Set<number>;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  segments,
  annotatedPositions,
}) => {
  return (
    <>
      {segments.map((item, index) => {
        const position = item.position ?? index;
        const hasAnnotation = annotatedPositions?.has(position) ?? false;
        return (
          <div
            key={item.id ?? index}
            className="relative flex items-stretch gap-1"
          >
            <button
              data-segment-id={item.id}
              data-position={position}
              data-start={item.start ?? 0}
              className="flex-1 text-left p-2 rounded-lg transition-colors cursor-pointer hover:bg-(--color-border)/30 data-[active]:bg-(--color-primary)/10 data-[active]:border-l-2 data-[active]:border-(--color-primary) data-[active]:hover:bg-(--color-primary)/10"
            >
              <span className="text-xs text-(--color-description) block">
                {item.speaker}
              </span>
              <span className="text-sm">{item.text}</span>
            </button>
            {hasAnnotation && (
              <button
                type="button"
                data-annotation-marker={position}
                aria-label="Показать аннотации к сегменту"
                className="self-stretch w-2 rounded bg-(--color-primary)/60 hover:bg-(--color-primary) transition-colors"
              />
            )}
          </div>
        );
      })}
    </>
  );
};
