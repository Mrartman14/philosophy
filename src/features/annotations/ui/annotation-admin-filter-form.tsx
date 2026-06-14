"use client";
// src/features/annotations/ui/annotation-admin-filter-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PARENT_ENTITY_TYPES as PARENT_TYPES } from "../types";

/**
 * Фильтр admin-списка аннотаций по типу родительской сущности. Обновляет URL
 * (server-side фильтрация, conventions §3.5). Сбрасывает offset при смене.
 */
export function AnnotationAdminFilterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    <label className="flex items-center gap-2 text-sm">
      Тип сущности:
      <select
        value={current}
        onChange={(e) => { onChange(e.target.value); }}
        className="rounded border border-(--color-border) px-2 py-1"
      >
        <option value="">Все</option>
        {PARENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
