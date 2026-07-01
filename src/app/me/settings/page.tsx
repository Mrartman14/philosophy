// src/app/me/settings/page.tsx
import type { Metadata } from "next";

import { ChevronIcon } from "@/assets/icons/chevron-icon";
import { RouterLink } from "@/components/ui";
import { LogoutAllForm, LogoutForm } from "@/features/auth";
import { SubscriptionsSection } from "@/features/notifications";
import {
  CommentReplyNotifyToggle,
  PreferencesForm,
  PushSubscriptionToggle,
  canSubscribePush,
  canUpdatePreferences,
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
import { getStoredTzPref } from "@/utils/timezone-server";

import { AppearanceSettings } from "./appearance/appearance-settings";
import { LocaleSettings } from "./locale-settings";
import { TimezoneSettings } from "./timezone-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("metadata");
  return { title: t("settingsTitle") };
}

export default async function SettingsPage() {
  const me = await requireUserOrRedirect("/me/settings");
  const t = await getT("settings");

  const [prefs, vapidPublicKey, historySettings, storedLocale, storedTimezone] =
    await Promise.all([
      getPreferences(),
      getVapidKey(),
      getHistorySettings(),
      getStoredLocale(),
      getStoredTzPref(),
    ]);
  // reading_mode в schema.ts — string|undefined; сужаем с фоллбеком на
  // дефолт бекенда (internal/preference/model.go: DefaultPreferences).
  const readingMode: ReadingMode =
    prefs.reading_mode === "focused" ? "focused" : "full";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>

      <AppearanceSettings />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("sectionLanguage")}</h2>
        <LocaleSettings initial={storedLocale} />
        <TimezoneSettings initial={storedTimezone} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("sectionReading")}</h2>
        <PreferencesForm initialReadingMode={readingMode} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("sectionPush")}</h2>
        <PushSubscriptionToggle
          vapidPublicKey={vapidPublicKey}
          canSubscribe={canSubscribePush(me)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("sectionSubscriptions")}</h2>
        <CommentReplyNotifyToggle
          initialEnabled={prefs.notify_on_comment_reply ?? true}
          canManage={canUpdatePreferences(me)}
        />
        <SubscriptionsSection />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("sectionHistory")}</h2>
        <HistoryTrackingToggle
          initialEnabled={historySettings.tracking_enabled ?? false}
          canManage={canManageOwnHistory(me)}
        />
        <RouterLink href="/me/stats" className="inline-flex items-center gap-1 text-sm">
          {t("viewMyStats")}
          <ChevronIcon className="rtl-flip" />
        </RouterLink>
      </section>

      <section className="flex flex-col items-start gap-3 border-t border-(--color-border) pt-8">
        <h2 className="text-lg font-semibold">{t("sectionAccount")}</h2>
        <RouterLink href="/me/tokens" className="inline-flex items-center gap-1 text-sm">
          {t("manageTokens")}
          <ChevronIcon className="rtl-flip" />
        </RouterLink>
        <LogoutForm />
        <LogoutAllForm />
      </section>
    </div>
  );
}
