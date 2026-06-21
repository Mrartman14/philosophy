"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { FormField, Select } from "@/components/ui";
import { useT } from "@/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import { persistLocale } from "@/i18n/persist-locale";

export function LocaleSettings({ initial }: { initial: Locale }) {
  const t = useT("settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const OPTIONS = [
    { value: "system", label: t("localeSystem") },
    { value: "ru", label: t("localeRu") },
    { value: "en", label: t("localeEn") },
  ];

  function onChange(v: string) {
    const next = v as Locale;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax; secure`;
    void persistLocale(next);
    // Локаль-зависимые сообщения приходят с сервера → перечитываем дерево.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <FormField name="locale" label={t("localeLabelRow")}>
      <Select
        aria-label={t("localeAriaLabel")}
        options={OPTIONS}
        value={initial}
        onValueChange={onChange}
        disabled={pending}
      />
    </FormField>
  );
}
