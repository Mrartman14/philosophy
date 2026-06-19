// src/app/submissions/[id]/page.tsx
import { notFound } from "next/navigation";

import {
  getSubmissionById,
  getFormById,
  canEditSubmission,
  canDeleteSubmission,
  canRetractSubmission,
  SubmissionDetail,
  SubmissionEditForm,
  SubmissionActions,
} from "@/features/forms";
import { requireActiveUserOrRedirect } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Отклик" };

/**
 * Просмотр отдельного отклика. Двусторонняя приватность бека
 * (CanSeeSubmission): содержимое видят ТОЛЬКО автор отклика и владелец формы.
 * Бек скрывает существование от остальных (404 → getSubmissionById === null →
 * notFound). Share-токенов и admin-override для откликов нет.
 *
 * Действия (edit/delete/retract) — строго автор и только в соответствующем
 * режиме формы; владелец формы читает, но НЕ правит (бек: любая мутация
 * не-автором → 404). Поэтому owner просто не получает ни одной кнопки.
 */
export default async function SubmissionPage({ params }: Props) {
  const { id } = await params;
  // Аноним всё равно получит 404 от бека, но логин-редирект — лучше UX.
  const me = await requireActiveUserOrRedirect(`/submissions/${id}`);

  const submission = await getSubmissionById(id);
  if (!submission) notFound();

  const form = await getFormById(submission.form_id ?? "");
  if (!form) notFound();

  // Все три взаимоисключающие по режиму формы + авторству. Для владельца
  // (не автора) все три = false → видит только содержимое.
  const canEdit = canEditSubmission(me, form, submission);
  const canDelete = canDeleteSubmission(me, form, submission);
  const canRetract = canRetractSubmission(me, form, submission);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{form.title}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {submission.retracted_at
            ? "Отклик отозван"
            : `Отправлен ${new Date(submission.submitted_at ?? "").toLocaleString("ru-RU")}`}
        </p>
      </header>

      {canEdit ? (
        // editable + автор + не отозван: правка ответов на месте.
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Ваш отклик</h2>
          <SubmissionEditForm form={form} submission={submission} />
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Содержимое отклика</h2>
          <SubmissionDetail form={form} submission={submission} />
        </section>
      )}

      {/* Удаление (editable-автор, освобождает слот) либо отзыв (immutable-автор,
          сжигает слот). Владелец формы не получает ни одной из кнопок. */}
      {(canDelete || canRetract) && submission.id && (
        <section className="flex flex-col gap-2 border-t border-(--color-border) pt-4">
          {canDelete && <SubmissionActions submissionId={submission.id} kind="delete" />}
          {canRetract && <SubmissionActions submissionId={submission.id} kind="retract" />}
        </section>
      )}
    </div>
  );
}
