"use client";

import { useRegisterSW } from "@/hooks/use-register-sw";

export const UpdatePrompt: React.FC = () => {
  const { needsUpdate, applyUpdate } = useRegisterSW();

  if (!needsUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-(--text-pane) border border-(--border) shadow-lg">
      <span className="text-sm">Доступно обновление</span>
      <button
        onClick={applyUpdate}
        className="text-sm font-medium px-3 py-1 rounded bg-(--foreground) text-(--background) hover:opacity-80"
      >
        Обновить
      </button>
    </div>
  );
};
