"use client";
// src/features/share-links/ui/share-lookup-form.tsx
import { useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { Button, Form, FormField, Inline, Select, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";
import { useT } from "@/i18n/client";

import {
  SHARE_RESOURCE_TYPES,
  ALL_RESOURCE_TYPES,
} from "../types";

interface Props {
  /** admin-инструмент допускает canvas (admin может искать canvas-ссылки). */
  admin?: boolean;
}

/**
 * Форма поиска ссылок по ресурсу. Кладёт resource_type + resource_id в URL
 * (server-side фильтрация — страница перечитает fetcher). Бек не отдаёт
 * глобальный «список всех моих ссылок», поэтому управление — per-resource.
 */
export function ShareLookupForm({ admin = false }: Props) {
  const searchParams = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();
  const t = useT("shareLinks");

  const types = admin ? ALL_RESOURCE_TYPES : SHARE_RESOURCE_TYPES;
  const options = types.map((type) => ({
    value: type,
    label: t(`resourceTypes.${type}`),
  }));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawRt = fd.get("resource_type");
    const rawRid = fd.get("resource_id");
    const rt = (typeof rawRt === "string" ? rawRt : "").trim();
    const rid = (typeof rawRid === "string" ? rawRid : "").trim();
    // Fresh URLSearchParams — intentionally drops all other params.
    const params = new URLSearchParams();
    if (rt) params.set("resource_type", rt);
    if (rid) params.set("resource_id", rid);
    navigate(params);
  }

  return (
    <Form onSubmit={onSubmit}>
      <Inline align="end">
        <FormField name="resource_type" label={t("resourceTypeLabel")}>
          <Select
            name="resource_type"
            defaultValue={searchParams.get("resource_type") ?? types[0]}
            options={options}
            aria-label={t("resourceTypeLabel")}
          />
        </FormField>
        <FormField name="resource_id" label={t("resourceIdLabel")} className="flex-1">
          <TextInput
            id="resource_id"
            name="resource_id"
            defaultValue={searchParams.get("resource_id") ?? ""}
            placeholder={t("resourceIdPlaceholder")}
          />
        </FormField>
        <Button type="submit" disabled={pending}>
          {pending ? "…" : t("showLinksButton")}
        </Button>
      </Inline>
    </Form>
  );
}
