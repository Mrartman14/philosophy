// src/components/attachments/attach-target-picker.tsx
"use client";
import { AsyncCombobox } from "@/components/ast-editor/pickers/async-combobox";
import { useT } from "@/i18n/client";

import type { AttachTargetPickerProps } from "./types";

interface Target {
  id: string;
  label: string;
}

/**
 * Пикер целевой сущности для attach. Использует AsyncCombobox из ast-editor
 * (deep-import в @/components легален). Доменно-нейтрален: fetcher отдаёт
 * {id, label}; потребитель конфигурирует его под свой эндпоинт.
 */
export function AttachTargetPicker({
  fetcher,
  onSelect,
  onClose,
  placeholder,
}: AttachTargetPickerProps) {
  const t = useT("common");
  return (
    <AsyncCombobox<Target>
      fetcher={fetcher}
      renderItem={(item) => <span>{item.label}</span>}
      getKey={(item) => item.id}
      onSelect={(item) => { onSelect(item.id, item.label); }}
      {...(onClose ? { onClose } : {})}
      placeholder={placeholder ?? t("attachments.search")}
    />
  );
}
