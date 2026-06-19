// src/features/forms/ui/form-meta.tsx
import type { Form } from "../types";

const visLabel: Record<string, string> = { private: "Приватная", public: "Публичная" };
const modeLabel: Record<string, string> = {
  editable: "Отклик можно менять и удалять",
  immutable: "Отклик можно только отозвать",
};

export function FormMeta({ form }: { form: Form }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-(--color-fg-muted)">
      <span className="rounded border border-(--color-border) px-2 py-0.5">
        {visLabel[form.visibility ?? "private"] ?? form.visibility}
      </span>
      <span className="rounded border border-(--color-border) px-2 py-0.5">
        {modeLabel[form.submission_mode ?? "editable"] ?? form.submission_mode}
      </span>
      {form.published_at && (
        <span className="rounded border border-(--color-border) px-2 py-0.5">Опубликована</span>
      )}
    </div>
  );
}
