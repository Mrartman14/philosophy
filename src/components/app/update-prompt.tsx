"use client";

import { Button } from "@/components/ui";
import { useRegisterSW } from "@/hooks/use-register-sw";
import { useT } from "@/i18n/client";

export const UpdatePrompt: React.FC = () => {
  const t = useT("common");
  const { needsUpdate, applyUpdate } = useRegisterSW();

  if (!needsUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-(--color-surface-subtle) border border-(--color-border) shadow-lg">
      <span className="text-sm">{t("updatePrompt.updateAvailable")}</span>
      <Button size="sm" onClick={applyUpdate}>
        {t("updatePrompt.update")}
      </Button>
    </div>
  );
};
