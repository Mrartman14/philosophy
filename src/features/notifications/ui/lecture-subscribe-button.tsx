"use client";
// src/features/notifications/ui/lecture-subscribe-button.tsx
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { subscribeLecture, unsubscribeLecture } from "../actions";

interface LectureSubscribeButtonProps {
  lectureId: string;
  initialSubscribed: boolean;
}

export function LectureSubscribeButton({
  lectureId,
  initialSubscribed,
}: LectureSubscribeButtonProps) {
  const toast = useToast();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !subscribed;
    setPending(true);
    setSubscribed(next); // оптимистично
    try {
      const result = next
        ? await subscribeLecture(lectureId)
        : await unsubscribeLecture(lectureId);
      if (!result.success) {
        setSubscribed(!next); // откат
        toastActionError(toast, result, { action: "подписку" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      {...(subscribed ? { variant: "secondary" as const } : {})}
      disabled={pending}
      onClick={() => {
        void toggle();
      }}
    >
      {subscribed ? "Отписаться" : "Подписаться"}
    </Button>
  );
}
