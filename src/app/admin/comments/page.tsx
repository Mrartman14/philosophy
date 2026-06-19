// src/app/admin/comments/page.tsx
import { forbidden } from "next/navigation";

import { Button, TextInput } from "@/components/ui";
import {
  canModerateComments,
  getAdminLectureComments,
  AdminCommentRow,
} from "@/features/comments";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  searchParams: Promise<{ lecture_id?: string }>;
}

export const metadata = { title: "Модерация комментариев" };

/**
 * Admin-модерация комментариев ПЕР-ЛЕКЦИОННАЯ: бек требует lecture_id
 * (GET /api/admin/comments → 422 без него; глобального списка нет).
 * Поэтому страница начинается с выбора лекции (ввод lecture_id) и
 * показывает список только когда он задан.
 */
export default async function AdminCommentsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateComments(me)) forbidden();

  const { lecture_id } = await searchParams;
  const list = lecture_id
    ? await getAdminLectureComments(lecture_id)
    : null;

  const t = await getT("admin");

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("commentsTitle")}</h1>

      <form method="get" className="flex items-end gap-2">
        <label htmlFor="lecture_id" className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-(--color-fg-muted)">{t("commentsLectureIdLabel")}</span>
          <TextInput
            id="lecture_id"
            name="lecture_id"
            defaultValue={lecture_id ?? ""}
            placeholder={t("commentsLectureIdPlaceholder")}
          />
        </label>
        <Button type="submit">{t("commentsShowButton")}</Button>
      </form>

      {!lecture_id && (
        <p className="text-sm text-(--color-fg-muted)">
          {t("commentsNoLectureHint")}
        </p>
      )}

      {list && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-(--color-fg-muted)">{t("commentsTotal", { total: list.total })}</p>
          {list.items.length === 0 ? (
            <p className="text-sm text-(--color-fg-muted)">{t("commentsEmpty")}</p>
          ) : (
            list.items.map((c) => <AdminCommentRow key={c.id} comment={c} />)
          )}
        </div>
      )}
    </section>
  );
}
