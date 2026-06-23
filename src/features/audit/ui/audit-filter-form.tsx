"use client";
// src/features/audit/ui/audit-filter-form.tsx
import { useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { Button, Form, FormField, Select, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";
import { useT } from "@/i18n/client";

import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "../target-types";

/** Sentinel «все типы»/«все действия» для Select — в URL не сериализуется. */
const ALL_TYPES = "all";

const FILTER_FIELDS = [
  "actor",
  "target_type",
  "target_id",
  "action",
  "from",
  "to",
] as const;

export function AuditFilterForm() {
  const t = useT("audit");
  const searchParams = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();

  const TARGET_TYPE_OPTIONS = [
    { value: ALL_TYPES, label: t("filterAllTypes") },
    ...AUDIT_TARGET_TYPES.map((type) => ({ value: type, label: type })),
  ];

  const ACTION_OPTIONS = [
    { value: ALL_TYPES, label: t("filterAllActions") },
    ...AUDIT_ACTIONS.map((action) => ({ value: action, label: action })),
  ];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const field of FILTER_FIELDS) {
      const rawVal = fd.get(field);
      const value = (typeof rawVal === "string" ? rawVal : "").trim();
      if (value && value !== ALL_TYPES) params.set(field, value);
      else params.delete(field);
    }
    params.delete("offset");
    navigate(params);
  }

  function onReset() {
    navigate(new URLSearchParams());
  }

  return (
    <Form onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormField name="actor" label={t("filterActorLabel")}>
          <TextInput
            defaultValue={searchParams.get("actor") ?? ""}
            placeholder="550e8400-e29b-…"
          />
        </FormField>
        <FormField name="target_type" label={t("filterTargetTypeLabel")}>
          <Select
            defaultValue={searchParams.get("target_type") ?? ALL_TYPES}
            options={TARGET_TYPE_OPTIONS}
            aria-label={t("filterTargetTypeLabel")}
          />
        </FormField>
        <FormField name="target_id" label={t("filterTargetIdLabel")}>
          <TextInput
            defaultValue={searchParams.get("target_id") ?? ""}
            placeholder={t("filterTargetIdPlaceholder")}
          />
        </FormField>
        <FormField name="action" label={t("filterActionLabel")}>
          <Select
            defaultValue={searchParams.get("action") ?? ALL_TYPES}
            options={ACTION_OPTIONS}
            aria-label={t("filterActionLabel")}
          />
        </FormField>
        <FormField name="from" label={t("filterFromLabel")}>
          <TextInput
            type="datetime-local"
            defaultValue={searchParams.get("from") ?? ""}
          />
        </FormField>
        <FormField name="to" label={t("filterToLabel")}>
          <TextInput
            type="datetime-local"
            defaultValue={searchParams.get("to") ?? ""}
          />
        </FormField>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? "…" : t("filterSubmit")}
          </Button>
          <Button type="button" tone="quiet" onClick={onReset} disabled={pending}>
            {t("filterReset")}
          </Button>
        </div>
      </div>
    </Form>
  );
}
