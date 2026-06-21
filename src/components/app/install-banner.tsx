"use client";

import { Button } from "@/components/ui";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useT } from "@/i18n/client";

export const InstallBanner: React.FC = () => {
  const t = useT("common");
  const { canInstall, isIOS, isStandalone, promptInstall } =
    useInstallPrompt();

  if (isStandalone) return null;

  if (canInstall) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-(--color-border) bg-(--color-surface-subtle)">
        <span className="text-sm">{t("installBanner.installApp")}</span>
        {/* Позиция (shrink-0) — на структурном обёртке, не на styled-контроле (Guardrail 8). */}
        <span className="shrink-0">
          <Button
            compact
            onClick={() => { void promptInstall(); }}
          >
            {t("installBanner.install")}
          </Button>
        </span>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-(--color-border) bg-(--color-surface-subtle) text-sm text-(--color-fg-muted)">
        {t("installBanner.iosHint")}
      </div>
    );
  }

  return null;
};
