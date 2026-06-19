"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useTransition } from "react";

import { Select } from "@/components/ui";
import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import { persistLocale } from "@/i18n/persist-locale";

const OPTIONS = [
  { value: "system", label: "Как в системе" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export function LocaleSettings({ initial }: { initial: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
    <Row label="Язык">
      <Select
        aria-label="Язык интерфейса"
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
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
