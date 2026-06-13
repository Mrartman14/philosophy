// src/features/forms/ui/my-submissions-list.tsx
import Link from "next/link";
import type { SubmissionListItem } from "../types";

interface Props {
  submissions: SubmissionListItem[];
}

export function MySubmissionsList({ submissions }: Props) {
  if (submissions.length === 0) {
    return <p className="text-sm text-(--color-description)">У вас пока нет откликов.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {submissions.map((s) => (
        <li key={s.id} id={s.id} className="flex items-center justify-between gap-2 py-2">
          <Link href={`/forms/${s.form_id}`} className="text-sm hover:underline">
            Форма {s.form_id?.slice(0, 8)}
          </Link>
          <span className="text-xs text-(--color-description)">
            {s.retracted_at ? "отозван" : new Date(s.submitted_at ?? "").toLocaleString("ru-RU")}
          </span>
        </li>
      ))}
    </ul>
  );
}
