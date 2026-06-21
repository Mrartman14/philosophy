"use client";
import { useReducedMotion } from "@/components/appearance";
import { Button, Dialog, Skeleton } from "@/components/ui";
import { useT } from "@/i18n/client";

export function MotionShowcase() {
  const reduce = useReducedMotion();
  const t = useT("design");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {t("motionStatusPrefix")} <strong>{reduce ? t("motionOn") : t("motionOff")}</strong>{" "}
        <span className="text-(--color-fg-muted)">— {t("motionHint")}</span>
      </p>

      <Row label={t("motionSkeleton")}>
        <Skeleton className="h-4 w-48" />
      </Row>

      <Row label={t("motionSpin")}>
        <div className="size-8 rounded bg-(--color-accent) animate-spin" />
      </Row>

      <Row label={t("motionFancy")}>
        <span className="fancy-link w-fit">{t("motionFancyText")}</span>
      </Row>

      <Row label={t("motionDialog")}>
        <Dialog title={t("motionDialogTitle")} trigger={<Button variant="secondary">{t("motionDialogTrigger")}</Button>}>
          <p className="text-sm">{t("motionDialogBody")}</p>
        </Dialog>
      </Row>

      <p className="text-sm text-(--color-fg-muted)">{t("motionMapNote")}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-(--color-fg-muted)">{label}</span>
      {children}
    </div>
  );
}
