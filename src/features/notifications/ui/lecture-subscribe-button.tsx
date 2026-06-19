"use client";
// src/features/notifications/ui/lecture-subscribe-button.tsx

import { subscribeLecture, unsubscribeLecture } from "../actions";

import { SubscribeButton } from "./subscribe-button";

interface LectureSubscribeButtonProps {
  lectureId: string;
  initialSubscribed: boolean;
}

export function LectureSubscribeButton({
  lectureId,
  initialSubscribed,
}: LectureSubscribeButtonProps) {
  return (
    <SubscribeButton
      entityId={lectureId}
      initialSubscribed={initialSubscribed}
      subscribeAction={subscribeLecture}
      unsubscribeAction={unsubscribeLecture}
    />
  );
}
