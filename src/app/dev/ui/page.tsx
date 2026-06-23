// src/app/dev/ui/page.tsx — публичная витрина дизайн-системы (APCA + appearance + motion)
import type { Metadata } from "next";

// ВНИМАНИЕ: это ПУБЛИЧНАЯ страница, тянущая компонент из аутентифицированного /me-дерева.
// AppearanceSettings ОБЯЗАН оставаться чистым client-компонентом (без getMe/server-only импортов),
// иначе публичная витрина сломается или утечёт что-то из приватной зоны.
import { AppearanceSettings } from "@/app/me/settings/appearance/appearance-settings";
import { WideShell } from "@/components/ui";
import { getT } from "@/i18n";

import { ApcaMatrix } from "./apca-matrix";
import { MotionShowcase } from "./motion-showcase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("design");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function DesignShowcasePage() {
  const t = await getT("design");
  return (
    <WideShell>
      <div className="flex flex-col gap-10 p-8">
        <h1 className="text-2xl font-bold">{t("metaTitle")}</h1>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("appearanceTitle")}</h2>
          <p className="text-sm text-(--color-fg-muted)">{t("appearanceWarning")}</p>
          <AppearanceSettings />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("tokensTitle")}</h2>
          <p className="text-sm text-(--color-fg-muted)">{t("tokensHint")}</p>
          <ApcaMatrix />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("motionTitle")}</h2>
          <MotionShowcase />
        </section>
      </div>
    </WideShell>
  );
}
