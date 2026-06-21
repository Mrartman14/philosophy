"use client";
// src/features/forms/ui/form-builder-field-row.tsx
import { Button, Fieldset, Label, Select, TextInput, Textarea, Checkbox } from "@/components/ui";
import { useT } from "@/i18n/client";

import { FIELD_TYPES, fieldTypeHasOptions } from "../field-kinds";
import type { FieldType } from "../types";

export interface BuilderField {
  type: FieldType;
  prompt: string;
  help_text: string;
  required: boolean;
  options: string[];
}

interface Props {
  index: number;
  field: BuilderField;
  disabled?: boolean;
  onChange: (next: BuilderField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function FormBuilderFieldRow({
  index,
  field,
  disabled = false,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Props) {
  const t = useT("forms");
  const hasOptions = fieldTypeHasOptions(field.type);

  return (
    <Fieldset className="gap-3 rounded border border-(--color-border) p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("fieldRow.heading", { index: index + 1 })}</span>
        <div className="flex gap-1">
          <Button type="button" tone="quiet" compact disabled={disabled || !canMoveUp} onClick={onMoveUp} aria-label={t("fieldRow.ariaUp")}>↑</Button>
          <Button type="button" tone="quiet" compact disabled={disabled || !canMoveDown} onClick={onMoveDown} aria-label={t("fieldRow.ariaDown")}>↓</Button>
          <Button type="button" tone="danger" compact disabled={disabled} onClick={onRemove} aria-label={t("fieldRow.ariaRemove")}>✕</Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <Label>{t("fieldRow.typeLabel")}</Label>
        <Select
          aria-label={t("fieldRow.typeLabel")}
          value={field.type}
          disabled={disabled}
          onValueChange={(v) => {
            const type = v as FieldType;
            const next: BuilderField = { ...field, type };
            if (!fieldTypeHasOptions(type)) next.options = [];
            else if (next.options.length === 0) next.options = [""];
            onChange(next);
          }}
          options={FIELD_TYPES.map((type) => ({ value: type, label: t(`fieldType.${type}`) }))}
        />
      </div>

      <Label htmlFor={`field-${String(index)}-prompt`} className="flex flex-col gap-1 text-sm">
        {t("fieldRow.promptLabel")}
        <TextInput
          id={`field-${String(index)}-prompt`}
          value={field.prompt}
          disabled={disabled}
          maxLength={2000}
          onChange={(e) => { onChange({ ...field, prompt: e.target.value }); }}
        />
      </Label>

      <Label htmlFor={`field-${String(index)}-help`} className="flex flex-col gap-1 text-sm">
        {t("fieldRow.helpLabel")}
        <Textarea
          id={`field-${String(index)}-help`}
          value={field.help_text}
          disabled={disabled}
          rows={2}
          onChange={(e) => { onChange({ ...field, help_text: e.target.value }); }}
        />
      </Label>

      <Label htmlFor={`field-${String(index)}-required`} className="flex items-center gap-2 text-sm">
        <Checkbox
          id={`field-${String(index)}-required`}
          checked={field.required}
          disabled={disabled}
          onCheckedChange={(v) => { onChange({ ...field, required: v }); }}
        />
        {t("fieldRow.requiredLabel")}
      </Label>

      {hasOptions && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">{t("fieldRow.optionsLabel")}</span>
          {field.options.map((opt, oi) => (
            <div key={oi} className="flex gap-2">
              <TextInput
                value={opt}
                disabled={disabled}
                placeholder={t("fieldRow.optionPlaceholder", { index: oi + 1 })}
                onChange={(e) => {
                  const options = field.options.slice();
                  options[oi] = e.target.value;
                  onChange({ ...field, options });
                }}
              />
              <Button
                type="button"
                tone="quiet"
                compact
                disabled={disabled || field.options.length <= 1}
                onClick={() => { onChange({ ...field, options: field.options.filter((_, i) => i !== oi) }); }}
                aria-label={t("fieldRow.ariaRemoveOption")}
              >✕</Button>
            </div>
          ))}
          <Button
            type="button"
            tone="neutral"
            compact
            disabled={disabled}
            onClick={() => { onChange({ ...field, options: [...field.options, ""] }); }}
          >
            {t("fieldRow.addOption")}
          </Button>
        </div>
      )}
    </Fieldset>
  );
}
