"use client";
// src/features/annotations/ui/annotation-admin-filter-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Label, Select } from "@/components/ui";
import { useT } from "@/i18n/client";

import { PARENT_ENTITY_TYPES as PARENT_TYPES } from "../types";

/**
 * Фильтр admin-списка аннотаций по типу родительской сущности. Обновляет URL
 * (server-side фильтрация, conventions §3.5). Сбрасывает offset при смене.
 */
export function AnnotationAdminFilterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT("annotations");
  const current = searchParams.get("parent_entity_type") ?? "";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("parent_entity_type", value);
    else params.delete("parent_entity_type");
    params.delete("offset");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Label>{t("filterEntityTypeLabel")}</Label>
      <Select
        aria-label={t("filterEntityTypeLabel")}
        value={current}
        onValueChange={onChange}
        fill={false}
        options={[
          { value: "", label: t("filterEntityTypeAll") },
          ...PARENT_TYPES.map((tp) => ({ value: tp, label: tp })),
        ]}
      />
    </div>
  );
}
