"use client";

import { useEffect, useState, useCallback, RefObject } from "react";
import {
  VideoLectureData,
  TranscriptItem,
  BoardState,
} from "@/entities/video-lecture";

function findByTime<T extends { start: number; end: number }>(
  items: T[],
  time: number
): T | null {
  return items.find((item) => time >= item.start && time <= item.end) ?? null;
}

export function useSyncedPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  data: VideoLectureData | null
) {
  const [currentTranscriptId, setCurrentTranscriptId] = useState<number | null>(
    null
  );
  const [currentBoardState, setCurrentBoardState] = useState<BoardState | null>(
    null
  );

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
    if (!video || !data) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;

      const transcript = findByTime(data.transcript, time);
      setCurrentTranscriptId(transcript?.id ?? null);

      const board = findByTime(data.board_states, time);
      setCurrentBoardState(board);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [videoRef, data]);

  return { currentTranscriptId, currentBoardState, seekTo };
}
