import { useState, useCallback } from "react";
import { Slider } from "@base-ui/react/slider";
import { Popover } from "@base-ui/react/popover";
import { formatTime } from "@/utils/format-time";
import type { Chapter, Marker } from "./video-player";

function getChapterAtTime(chapters: Chapter[], time: number): Chapter | undefined {
  return chapters.find((c) => time >= c.startTime && time < c.endTime);
}

interface TimelineProps {
  currentTime: number;
  duration: number;
  buffered: number;
  chapters: Chapter[];
  markers: Marker[];
  onSeek: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  duration,
  buffered,
  chapters,
  markers,
  onSeek,
}) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const isScrubbing = scrubTime != null;

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverTime(ratio * duration);
    },
    [duration]
  );

  const handlePointerLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const hoverChapter = hoverTime != null ? getChapterAtTime(chapters, hoverTime) : undefined;

  return (
    <div
      className="relative flex-1 group"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Hover tooltip */}
      {hoverTime != null && (
        <div
          className="absolute bottom-full mb-2 -translate-x-1/2 pointer-events-none bg-(--color-background) border border-(--color-border) rounded px-2 py-1 text-xs whitespace-nowrap z-10"
          style={{ left: `${(hoverTime / duration) * 100}%` }}
        >
          <span className="tabular-nums">{formatTime(hoverTime)}</span>
          {hoverChapter && (
            <span className="ml-1.5 text-(--color-description)">{hoverChapter.title}</span>
          )}
        </div>
      )}

      <Slider.Root
        min={0}
        max={duration || 1}
        step={0.1}
        value={isScrubbing ? scrubTime : currentTime}
        onValueChange={(value) => setScrubTime(value)}
        onValueCommitted={(value) => {
          onSeek(value);
          setScrubTime(null);
        }}
        className="relative flex items-center h-6 cursor-pointer touch-none"
      >
        <Slider.Control className="relative flex items-center w-full h-full">
          <Slider.Track className="relative h-1 w-full rounded bg-(--color-border) group-hover:h-1.5 transition-[height]">
            {/* Buffered range */}
            <div
              className="absolute h-full rounded bg-(--color-description)/30"
              style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
            />
            {/* Chapter segments */}
            {chapters.length > 0 &&
              chapters.map((ch, i) => (
                <div
                  key={i}
                  className="absolute h-full bg-(--color-primary)/20"
                  style={{
                    left: `${(ch.startTime / duration) * 100}%`,
                    width: `${((ch.endTime - ch.startTime) / duration) * 100}%`,
                  }}
                />
              ))}
            {/* Chapter dividers */}
            {chapters.length > 1 &&
              chapters.slice(1).map((ch, i) => (
                <div
                  key={`div-${i}`}
                  className="absolute h-full w-0.5 bg-(--color-border)"
                  style={{ left: `${(ch.startTime / duration) * 100}%` }}
                />
              ))}
            <Slider.Indicator className="absolute h-full rounded bg-(--color-primary)" />
          </Slider.Track>
          <Slider.Thumb className="block w-3 h-3 rounded-full bg-(--color-primary) shadow opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--color-primary)" />
        </Slider.Control>
      </Slider.Root>

      {/* Markers */}
      {markers.map((marker, i) => (
        <TimelineMarker key={i} marker={marker} duration={duration} />
      ))}
    </div>
  );
};

// --- Marker with hover popover ---
const TimelineMarker: React.FC<{ marker: Marker; duration: number }> = ({ marker, duration }) => (
  <Popover.Root>
    <Popover.Trigger
      openOnHover
      delay={200}
      closeDelay={300}
      className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-(--color-primary) rounded-sm cursor-pointer z-10"
      style={{ left: `${(marker.time / duration) * 100}%` }}
      aria-label={marker.label}
    />
    <Popover.Portal>
      <Popover.Positioner sideOffset={8}>
        <Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-2 text-sm shadow-lg max-w-xs">
          <Popover.Arrow className="fill-(--color-background) stroke-(--color-border)" />
          <p className="font-medium">{marker.label}</p>
          {marker.content}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);
