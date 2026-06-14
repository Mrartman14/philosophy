// src/features/forms/ui/my-forms-list.tsx
import Link from "next/link";
import type { FormListItem } from "../types";

interface Props {
  forms: FormListItem[];
}

const visLabel: Record<string, string> = { private: "приватная", public: "публичная" };
const modeLabel: Record<string, string> = { editable: "редактируемый", immutable: "без изменений" };

export function MyFormsList({ forms }: Props) {
  if (forms.length === 0) {
    return <p className="text-sm text-(--color-description)">У вас пока нет форм.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {forms.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-2 py-2">
          <Link href={`/forms/${f.id}`} className="text-sm hover:underline">
            {f.title ?? "Без названия"}
          </Link>
          <span className="text-xs text-(--color-description)">
            {visLabel[f.visibility ?? "private"] ?? f.visibility}
            {" · "}
            {modeLabel[f.submission_mode ?? "editable"] ?? f.submission_mode}
            {f.published_at ? " · опубликована" : " · черновик"}
          </span>
        </li>
      ))}
    </ul>
  );
}
