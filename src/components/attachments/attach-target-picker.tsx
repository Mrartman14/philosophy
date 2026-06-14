// src/components/attachments/attach-target-picker.tsx
"use client";
import { AsyncCombobox } from "@/components/ast-editor/pickers/async-combobox";
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
  return (
    <AsyncCombobox<Target>
      fetcher={fetcher}
      renderItem={(t) => <span>{t.label}</span>}
      getKey={(t) => t.id}
      onSelect={(t) => { onSelect(t.id, t.label); }}
      {...(onClose ? { onClose } : {})}
      placeholder={placeholder ?? "Поиск…"}
    />
  );
}
