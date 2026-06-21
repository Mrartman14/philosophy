"use client";
// src/features/forms/ui/form-field-input.tsx
import { AstRender } from "@/components/ast-render";
import { Inline, Label, TextInput, Textarea } from "@/components/ui";

import type { AnswerInput } from "../answer-codec";
import type { FormField } from "../types";

interface Props {
  field: FormField;
  value: AnswerInput;
  disabled?: boolean;
  onChange: (next: AnswerInput) => void;
}

export function FormFieldInput({ field, value, disabled = false, onChange }: Props) {
  const type = field.type ?? "text";
  const options = field.options ?? [];

  return (
    <div className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <div className="content" data-size="sm">
        <AstRender blocks={field.prompt ?? []} />
        {field.required && <span className="text-red-600"> *</span>}
      </div>
      {(field.help_text?.length ?? 0) > 0 && (
        <div className="content text-(--color-fg-muted)" data-size="sm">
          <AstRender blocks={field.help_text ?? []} />
        </div>
      )}

      {type === "text" && (
        <TextInput
          disabled={disabled}
          value={"text" in value ? value.text : ""}
          onChange={(e) => { onChange({ text: e.target.value }); }}
        />
      )}
      {type === "long_text" && (
        <Textarea
          disabled={disabled}
          rows={4}
          value={"text" in value ? value.text : ""}
          onChange={(e) => { onChange({ text: e.target.value }); }}
        />
      )}
      {type === "number" && (
        <TextInput
          type="number"
          disabled={disabled}
          value={"number" in value ? value.number : ""}
          onChange={(e) => { onChange({ number: e.target.value }); }}
        />
      )}
      {type === "date" && (
        <TextInput
          type="date"
          disabled={disabled}
          value={"date" in value ? value.date : ""}
          onChange={(e) => { onChange({ date: e.target.value }); }}
        />
      )}
      {type === "single_choice" && (
        <div className="flex flex-col gap-1">
          {options.map((o) => (
            <Inline key={o.id} align="center" gap="tight" className="text-sm">
              <input
                id={`field-${field.id}-opt-${o.id}`}
                type="radio"
                name={`field-${field.id}`}
                disabled={disabled}
                checked={"optionId" in value && value.optionId === o.id}
                onChange={() => { onChange({ optionId: o.id ?? "" }); }}
              />
              <Label htmlFor={`field-${field.id}-opt-${o.id}`}>{o.label}</Label>
            </Inline>
          ))}
        </div>
      )}
      {type === "multi_choice" && (
        <div className="flex flex-col gap-1">
          {options.map((o) => {
            const ids = "optionIds" in value ? value.optionIds : [];
            const checked = ids.includes(o.id ?? "");
            return (
              <Inline key={o.id} align="center" gap="tight" className="text-sm">
                <input
                  id={`field-${field.id}-opt-${o.id}`}
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={(e) => {
                    const id = o.id ?? "";
                    const next = e.target.checked ? [...ids, id] : ids.filter((x) => x !== id);
                    onChange({ optionIds: next });
                  }}
                />
                <Label htmlFor={`field-${field.id}-opt-${o.id}`}>{o.label}</Label>
              </Inline>
            );
          })}
        </div>
      )}
    </div>
  );
}
