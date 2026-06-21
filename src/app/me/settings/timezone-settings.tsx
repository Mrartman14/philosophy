"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useTransition } from "react";

import { Select } from "@/components/ui";
import { useT } from "@/i18n/client";
import { persistTimezone } from "@/i18n/persist-timezone";
import {
  TZ_COOKIE,
  FALLBACK_ZONE,
  serializeTzCookie,
  isValidZone,
  type TzPref,
} from "@/utils/timezone";

/** Полный список IANA-зон среды; гарантированно валиден для бэка (no 422). */
function zoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [FALLBACK_ZONE, "UTC"];
  }
}

export function TimezoneSettings({ initial }: { initial: TzPref }) {
  const t = useT("settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () => [
      { value: "system", label: t("timezoneSystem") },
      ...zoneOptions().map((z) => ({ value: z, label: z })),
    ],
    [t],
  );

  function onChange(v: string) {
    const pref: TzPref = v === "system" ? "system" : v;
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const resolved =
      pref !== "system"
        ? pref
        : isValidZone(browserZone)
          ? browserZone
          : FALLBACK_ZONE;
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(serializeTzCookie({ pref, resolved }))}; path=/; max-age=31536000; samesite=lax; secure`;
    void persistTimezone(pref);
    // Зона рулит серверным форматтером дат → перечитываем дерево.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Row label={t("timezoneLabelRow")}>
      <Select
        aria-label={t("timezoneAriaLabel")}
        options={options}
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
