"use client";

import { useEffect, useState, useCallback, RefObject } from "react";

type SegmentTiming = { id?: number | undefined; start?: number | undefined; end?: number | undefined };

function findByTime(items: SegmentTiming[], time: number): SegmentTiming | null {
  return items.find((item) => time >= (item.start ?? 0) && time <= (item.end ?? 0)) ?? null;
}

export function useSyncedPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  segments: SegmentTiming[]
) {
  const [currentSegmentId, setCurrentSegmentId] = useState<number | null>(null);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = time;
      }
    },
    [videoRef]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      const segment = findByTime(segments, time);
      setCurrentSegmentId(segment?.id ?? null);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [videoRef, segments]);

  return { currentSegmentId, seekTo };
}
