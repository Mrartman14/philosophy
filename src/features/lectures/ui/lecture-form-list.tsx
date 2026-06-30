// src/features/lectures/ui/lecture-form-list.tsx
import { RouterLink } from "@/components/ui";

import { orderLectureForms } from "../order-forms";
import type { LectureFormItem } from "../types";

interface Props {
  forms: LectureFormItem[];
  token?: string | undefined;
  heading: string;
  entryBadge: string;
  untitledLabel: string;
}

/**
 * Секция форм лекции: ссылки на /forms/{id}. Лёгкий листинг
 * (GET /api/lectures/{id}/forms) — поля формы не рендерятся, заполнение/отправка
 * на странице /forms/{id}. Основная форма (is_entry) первой, с бейджем.
 * token (?token=) пробрасывается для приватных лекций (share-link). Пустой
 * список → секция не рендерится.
 */
export function LectureFormList({
  forms,
  token,
  heading,
  entryBadge,
  untitledLabel,
}: Props) {
  const ordered = orderLectureForms(forms);
  if (ordered.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={heading}>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <ul className="flex flex-col gap-2">
        {ordered.map((f) => {
          const href = token
            ? `/forms/${f.id}?token=${encodeURIComponent(token)}`
            : `/forms/${f.id}`;
          const trimmed = f.title?.trim() ?? "";
          return (
            <li key={f.id} className="flex items-center gap-2">
              <RouterLink href={href} className="text-(--color-link) hover:underline">
                {trimmed.length > 0 ? trimmed : untitledLabel}
              </RouterLink>
              {f.is_entry && (
                <span className="rounded bg-(--color-surface-subtle) px-1.5 py-0.5 text-xs text-(--color-fg-muted)">
                  {entryBadge}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
