"use client";
// src/features/banners/ui/banner-dismiss-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { IconButton, useToast } from "@/components/ui";
import { toastActionError } from "@/utils/action-toast";

import { dismissBanner } from "../actions";

interface Props {
  id: string;
}

/**
 * Кнопка «скрыть баннер». Рендерится ТОЛЬКО для авторизованных (условие
 * `authenticated` в ActiveBanners): dismiss на беке требует auth, анониму
 * кнопку не показываем (решение зафиксировано в плане, локального фоллбека
 * нет). После успеха — router.refresh(): ActiveBanners перезапрашивает
 * список, dismissed-баннер исчезает.
 */
export function BannerDismissButton({ id }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <IconButton
      aria-label="Скрыть баннер"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await dismissBanner(id);
          if (!result.success) {
            toastActionError(toast, result, {
              action: "скрытие баннера",
              forbiddenTitle: "Не удалось скрыть баннер",
              failureTitle: "Не удалось скрыть баннер",
            });
            return;
          }
          router.refresh();
        });
      }}
    >
      ×
    </IconButton>
  );
}
