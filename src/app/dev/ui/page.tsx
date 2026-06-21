// src/app/dev/ui/page.tsx — публичная витрина дизайн-системы (APCA + appearance + motion)
import type { Metadata } from "next";

import { AppearanceSettings } from "@/app/me/settings/appearance/appearance-settings";
import { getT } from "@/i18n";

import { ApcaMatrix } from "./apca-matrix";
import { MotionShowcase } from "./motion-showcase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("design");
  return { title: t("metaTitle") };
}

export default async function DesignShowcasePage() {
  const t = await getT("design");
  return (
    <div className="flex flex-col gap-10 p-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{t("appearanceTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("appearanceWarning")}</p>
        <AppearanceSettings />
      </section>

      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{t("tokensTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("tokensHint")}</p>
        <ApcaMatrix />
      </section>

      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{t("motionTitle")}</h1>
        <MotionShowcase />
      </section>
    </div>
  );
}
