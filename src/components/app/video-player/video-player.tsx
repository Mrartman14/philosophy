"use client";

import { useRef, useState, useImperativeHandle, forwardRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { PlayerControls } from "./player-controls";
import { PlayIcon } from "@/assets/icons/play-icon";
import { formatTime } from "@/utils/format-time";

export interface Chapter {
  title: string;
  startTime: number;
  endTime: number;
}

export interface Marker {
  time: number;
  label: string;
  content?: ReactNode;
}

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
}

interface VideoPlayerProps {
  src: string;
  chapters?: Chapter[];
  markers?: Marker[];
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({
  src,
  chapters = [],
  markers = [],
  onTimeUpdate,
  className,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useVideoPlayer(videoRef, containerRef, onTimeUpdate);
  const [collapsed, setCollapsed] = useState(false);

  useImperativeHandle(ref, () => ({ seekTo: player.seek }), [player.seek]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        className="w-full aspect-video bg-black"
        onClick={player.togglePlay}
      />
      <AnimatePresence>
        {collapsed ? (
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={() => setCollapsed(false)}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-background)/80 backdrop-blur text-sm text-(--color-primary) shadow cursor-pointer"
            aria-label="Показать контролы"
          >
            <PlayIcon className="text-base" />
            <span className="tabular-nums text-xs">{formatTime(player.currentTime)}</span>
          </motion.button>
        ) : (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
          >
            <PlayerControls
              playing={player.playing}
              currentTime={player.currentTime}
              duration={player.duration}
              buffered={player.buffered}
              chapters={chapters}
              markers={markers}
              playbackRate={player.playbackRate}
              volume={player.volume}
              muted={player.muted}
              isFullscreen={player.isFullscreen}
              isPip={player.isPip}
              onTogglePlay={player.togglePlay}
              onSkipBy={player.skipBy}
              onSeek={player.seek}
              onChangePlaybackRate={player.changePlaybackRate}
              onChangeVolume={player.changeVolume}
              onToggleMute={player.toggleMute}
              onToggleFullscreen={player.toggleFullscreen}
              onTogglePip={player.togglePip}
              onToggleCollapse={() => setCollapsed(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";
