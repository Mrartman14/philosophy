import { useState, useCallback } from "react";
import { Slider } from "@base-ui/react/slider";

const SNAP_POINTS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SNAP_THRESHOLD = 0.05;

function snapToNearest(value: number): number {
  for (const point of SNAP_POINTS) {
    if (Math.abs(value - point) <= SNAP_THRESHOLD) return point;
  }
  return Math.round(value * 20) / 20; // round to 0.05
}

interface SpeedSliderProps {
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
}

export const SpeedSlider: React.FC<SpeedSliderProps> = ({
  playbackRate,
  onChangePlaybackRate,
}) => {
  const [dragRate, setDragRate] = useState<number | null>(null);

  const resetSpeed = useCallback(() => {
    onChangePlaybackRate(1);
  }, [onChangePlaybackRate]);

  return (
    <div className="flex items-center gap-1.5">
      <Slider.Root
        min={0.5}
        max={2}
        step={0.05}
        value={dragRate ?? playbackRate}
        onValueChange={(value) => setDragRate(value)}
        onValueCommitted={(value) => {
          onChangePlaybackRate(snapToNearest(value));
          setDragRate(null);
        }}
        className="relative flex items-center w-16 cursor-pointer touch-none"
        aria-label="Скорость воспроизведения"
      >
        <Slider.Control className="relative flex items-center w-full h-6">
          <Slider.Track className="relative h-1 w-full rounded bg-(--color-border)">
            <Slider.Indicator className="absolute h-full rounded bg-(--color-primary)" />
          </Slider.Track>
          <Slider.Thumb className="block w-2.5 h-2.5 rounded-full bg-(--color-primary) shadow focus-visible:outline-2 focus-visible:outline-(--color-primary)" />
        </Slider.Control>
      </Slider.Root>

      <button
        onClick={resetSpeed}
        className="text-xs tabular-nums text-(--color-description) hover:text-(--color-primary) min-w-[2.5rem] text-center select-none"
        title="Сбросить скорость на 1x"
      >
        {(dragRate ?? playbackRate).toFixed(2).replace(/\.?0+$/, "")}x
      </button>
    </div>
  );
};
