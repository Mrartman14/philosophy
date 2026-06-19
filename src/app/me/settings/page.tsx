// src/app/me/settings/page.tsx
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
import { requireUserOrRedirect } from "@/utils/me";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const me = await requireUserOrRedirect("/me/settings");

  const [prefs, vapidPublicKey, historySettings] = await Promise.all([
    getPreferences(),
    getVapidKey(),
    getHistorySettings(),
  ]);
  // reading_mode в schema.ts — string|undefined; сужаем с фоллбеком на
  // дефолт бекенда (internal/preference/model.go: DefaultPreferences).
  const readingMode: ReadingMode =
    prefs.reading_mode === "focused" ? "focused" : "full";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">Настройки</h1>

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
