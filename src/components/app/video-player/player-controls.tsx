import { Toolbar } from "@base-ui/react/toolbar";
import { formatTime } from "@/utils/format-time";
import { PlayIcon } from "@/assets/icons/play-icon";
import { PauseIcon } from "@/assets/icons/pause-icon";
import { SkipBackIcon } from "@/assets/icons/skip-back-icon";
import { SkipForwardIcon } from "@/assets/icons/skip-forward-icon";
import { PrevSegmentIcon } from "@/assets/icons/prev-segment-icon";
import { NextSegmentIcon } from "@/assets/icons/next-segment-icon";
import { Timeline } from "./timeline";
import { SpeedSlider } from "./speed-slider";
import type { Chapter, Marker } from "./video-player";

interface PlayerControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  chapters: Chapter[];
  markers: Marker[];
  playbackRate: number;
  onTogglePlay: () => void;
  onSkipBy: (seconds: number) => void;
  onSeek: (time: number) => void;
  onChangePlaybackRate: (rate: number) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  playing,
  currentTime,
  duration,
  buffered,
  chapters,
  markers,
  playbackRate,
  onTogglePlay,
  onSkipBy,
  onSeek,
  onChangePlaybackRate,
}) => {
  const seekToSegment = (direction: -1 | 1) => {
    if (chapters.length === 0) return;
    const sorted = [...chapters].sort((a, b) => a.startTime - b.startTime);
    if (direction === -1) {
      const prev = sorted.filter((c) => c.startTime < currentTime - 1).pop();
      if (prev) onSeek(prev.startTime);
      else onSeek(0);
    } else {
      const next = sorted.find((c) => c.startTime > currentTime + 1);
      if (next) onSeek(next.startTime);
    }
  };

  return (
    <Toolbar.Root
      className="flex items-center gap-1 px-2 py-1 bg-(--color-background) border-t border-(--color-border)"
    >
      <Toolbar.Button
        onClick={() => seekToSegment(-1)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Предыдущий сегмент"
      >
        <PrevSegmentIcon />
      </Toolbar.Button>
      <Toolbar.Button
        onClick={() => onSkipBy(-10)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Назад на 10 секунд"
      >
        <SkipBackIcon />
      </Toolbar.Button>
      <Toolbar.Button
        onClick={onTogglePlay}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-primary) text-xl"
        aria-label={playing ? "Пауза" : "Воспроизвести"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Toolbar.Button>
      <Toolbar.Button
        onClick={() => onSkipBy(10)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Вперёд на 10 секунд"
      >
        <SkipForwardIcon />
      </Toolbar.Button>
      <Toolbar.Button
        onClick={() => seekToSegment(1)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Следующий сегмент"
      >
        <NextSegmentIcon />
      </Toolbar.Button>

      <Toolbar.Separator className="w-px h-4 bg-(--color-border) mx-1" />

      <span className="text-xs tabular-nums text-(--color-description) select-none whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <Timeline
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        chapters={chapters}
        markers={markers}
        onSeek={onSeek}
      />

      <SpeedSlider
        playbackRate={playbackRate}
        onChangePlaybackRate={onChangePlaybackRate}
      />
    </Toolbar.Root>
  );
};
