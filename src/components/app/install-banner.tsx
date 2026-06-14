"use client";

import { useInstallPrompt } from "@/hooks/use-install-prompt";

export const InstallBanner: React.FC = () => {
  const { canInstall, isIOS, isStandalone, promptInstall } =
    useInstallPrompt();

  if (isStandalone) return null;

  if (canInstall) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-(--color-border) bg-(--color-text-pane)">
        <span className="text-sm">Установить приложение на устройство</span>
        <button
          onClick={() => { void promptInstall(); }}
          className="text-sm font-medium px-3 py-1 rounded bg-(--color-foreground) text-(--color-background) hover:opacity-80 shrink-0"
        >
          Установить
        </button>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-(--color-border) bg-(--color-text-pane) text-sm text-(--color-description)">
        Нажмите «Поделиться» ⎋ → «На экран Домой» + чтобы установить
      </div>
    );
  }

  return null;
};
