"use client";
// src/features/media/ui/media-admin-filter-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, Form, Inline, Label, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";

/**
 * URL-фильтр admin-списка медиа по автору (owner_id). Зеркало
 * AnnotationAdminFilterForm по механике (router.replace, сброс offset), но
 * текстовый ввод: автор — UUID без конечного списка. Backend-ask Ask 1 расширит
 * до поиска по имени, когда бек отдаст username.
 */
export function MediaAdminFilterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT("admin");
  const [value, setValue] = useState(searchParams.get("owner_id") ?? "");

  function apply(ownerId: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = ownerId.trim();
    if (trimmed) params.set("owner_id", trimmed);
    else params.delete("owner_id");
    params.delete("offset");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply(value);
  }

  function onClear() {
    setValue("");
    apply("");
  }

  return (
    <Form onSubmit={onSubmit}>
      <Inline align="end" className="text-sm">
        <div className="flex flex-col gap-1">
          <Label htmlFor="media-owner-filter">{t("mediaFilterOwnerLabel")}</Label>
          <TextInput
            id="media-owner-filter"
            aria-label={t("mediaFilterOwnerLabel")}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
            }}
          />
        </div>
        <Button type="submit">{t("mediaFilterApply")}</Button>
        <Button type="button" tone="neutral" onClick={onClear}>
          {t("mediaFilterClear")}
        </Button>
      </Inline>
    </Form>
  );
}
