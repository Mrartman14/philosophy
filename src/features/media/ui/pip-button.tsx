"use client";
// src/features/media/ui/pip-button.tsx
import type { RefObject } from "react";

import { PictureInPictureIcon } from "@/assets/icons/picture-in-picture-icon";
import { IconButton, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";

import { usePictureInPicture } from "./use-picture-in-picture";

interface PipButtonProps {
  videoRef: RefObject<HTMLMediaElement | null>;
}

/** Кнопка Picture-in-Picture для видео. Рендерится только при поддержке PiP. */
export function PipButton({ videoRef }: PipButtonProps) {
  const t = useT("media");
  const { supported, active, toggle } = usePictureInPicture(videoRef);
  if (!supported) return null;
  return (
    <Inline>
      <IconButton
        tone="neutral"
        compact
        onClick={toggle}
        aria-label={active ? t("pipExit") : t("pipEnter")}
      >
        <PictureInPictureIcon />
      </IconButton>
    </Inline>
  );
}
