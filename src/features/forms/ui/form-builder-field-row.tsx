"use client";
// src/features/forms/ui/form-builder-field-row.tsx
import { Button, TextInput, Textarea, Checkbox } from "@/components/ui";
import { FIELD_TYPE_OPTIONS, fieldTypeHasOptions } from "../field-kinds";
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
  const hasOptions = fieldTypeHasOptions(field.type);

  return (
    <fieldset className="flex flex-col gap-3 rounded border border-(--color-border) p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Поле #{index + 1}</span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !canMoveUp} onClick={onMoveUp} aria-label="Вверх">↑</Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !canMoveDown} onClick={onMoveDown} aria-label="Вниз">↓</Button>
          <Button type="button" variant="danger" size="sm" disabled={disabled} onClick={onRemove} aria-label="Удалить">✕</Button>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Тип поля
        <select
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
          value={field.type}
          disabled={disabled}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            const next: BuilderField = { ...field, type };
            if (!fieldTypeHasOptions(type)) next.options = [];
            else if (next.options.length === 0) next.options = [""];
            onChange(next);
          }}
        >
          {FIELD_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Текст вопроса (markdown)
        <TextInput
          value={field.prompt}
          disabled={disabled}
          maxLength={2000}
          onChange={(e) => onChange({ ...field, prompt: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Подсказка (необязательно, markdown)
        <Textarea
          value={field.help_text}
          disabled={disabled}
          rows={2}
          onChange={(e) => onChange({ ...field, help_text: e.target.value })}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={field.required}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ ...field, required: v })}
        />
        Обязательное поле
      </label>

      {hasOptions && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">Варианты</span>
          {field.options.map((opt, oi) => (
            <div key={oi} className="flex gap-2">
              <TextInput
                value={opt}
                disabled={disabled}
                placeholder={`Вариант ${oi + 1}`}
                onChange={(e) => {
                  const options = field.options.slice();
                  options[oi] = e.target.value;
                  onChange({ ...field, options });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || field.options.length <= 1}
                onClick={() => onChange({ ...field, options: field.options.filter((_, i) => i !== oi) })}
                aria-label="Удалить вариант"
              >✕</Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onChange({ ...field, options: [...field.options, ""] })}
          >
            + Вариант
          </Button>
        </div>
      )}
    </fieldset>
  );
}
