"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useTransition } from "react";

import { Label, Select } from "@/components/ui";
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
    <Row label={t("localeLabelRow")}>
      <Select
        aria-label={t("localeAriaLabel")}
        options={OPTIONS}
        value={initial}
        onValueChange={onChange}
        disabled={pending}
      />
    </Row>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </Label>
  );
}
