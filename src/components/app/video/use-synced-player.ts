"use client";

import { useEffect, useState, useCallback, RefObject } from "react";
import type { components } from "@/api/schema";

type Segment = components["schemas"]["transcript.Segment"];

function findByTime(items: Segment[], time: number): Segment | null {
  return items.find((item) => time >= item.start && time <= item.end) ?? null;
}

export function useSyncedPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  segments: Segment[]
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
