// src/app/me/settings/page.tsx
import type { Metadata } from "next";

import { RouterLink } from "@/components/ui";
import { LogoutAllForm, LogoutForm } from "@/features/auth";
import { SubscriptionsSection } from "@/features/notifications";
import {
  PreferencesForm,
  PushSubscriptionToggle,
  canSubscribePush,
  getPreferences,
  getVapidKey,
  type ReadingMode,
} from "@/features/preferences";
import {
  HistoryTrackingToggle,
  canManageOwnHistory,
  getHistorySettings,
} from "@/features/statistics";
import { getStoredLocale, getT } from "@/i18n";
import { requireUserOrRedirect } from "@/utils/me";

import { AppearanceSettings } from "./appearance/appearance-settings";
import { LocaleSettings } from "./locale-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("metadata");
  return { title: t("settingsTitle") };
}

export default async function SettingsPage() {
  const me = await requireUserOrRedirect("/me/settings");

  const [prefs, vapidPublicKey, historySettings, storedLocale] =
    await Promise.all([
      getPreferences(),
      getVapidKey(),
      getHistorySettings(),
      getStoredLocale(),
    ]);
  // reading_mode в schema.ts — string|undefined; сужаем с фоллбеком на
  // дефолт бекенда (internal/preference/model.go: DefaultPreferences).
  const readingMode: ReadingMode =
    prefs.reading_mode === "focused" ? "focused" : "full";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <AppearanceSettings />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Язык интерфейса</h2>
        <LocaleSettings initial={storedLocale} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Чтение</h2>
        <PreferencesForm initialReadingMode={readingMode} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Push-уведомления</h2>
        <PushSubscriptionToggle
          vapidPublicKey={vapidPublicKey}
          canSubscribe={canSubscribePush(me)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Подписки на документы</h2>
        <SubscriptionsSection />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">История просмотров</h2>
        <HistoryTrackingToggle
          initialEnabled={historySettings.tracking_enabled ?? false}
          canManage={canManageOwnHistory(me)}
        />
        <RouterLink href="/me/stats" className="text-sm">
          Посмотреть мою статистику →
        </RouterLink>
      </section>

      <section className="flex flex-col items-start gap-3 border-t border-(--color-border) pt-8">
        <h2 className="text-lg font-semibold">Аккаунт</h2>
        <LogoutForm />
        <LogoutAllForm />
      </section>
    </div>
  );
}
