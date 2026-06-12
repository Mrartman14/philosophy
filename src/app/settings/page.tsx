// src/app/settings/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  PreferencesForm,
  PushSubscriptionToggle,
  canSubscribePush,
  getPreferences,
  getVapidKey,
  type ReadingMode,
} from "@/features/preferences";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/settings");

  const [prefs, vapidPublicKey] = await Promise.all([
    getPreferences(),
    getVapidKey(),
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
    </div>
  );
}
