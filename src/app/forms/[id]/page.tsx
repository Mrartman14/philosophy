// src/app/forms/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  getFormById,
  canEditForm,
  canPublishForm,
  canDeleteForm,
  canListFormSubmissions,
  FormDetail,
  FormFill,
  FormEditForm,
  FormPublishButton,
  FormDeleteButton,
} from "@/features/forms";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function FormPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const me = await getMe();
  const form = await getFormById(id, token);
  if (!form) notFound();

  const isOwner = !!me && me.status === "active" && me.id === form.owner_id;
  const canEdit = canEditForm(me, form);
  const canPublish = canPublishForm(me, form);
  const canDelete = canDeleteForm(me, form);
  const canSeeSubmissions = canListFormSubmissions(me, form);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-3">
        <FormDetail form={form} />
        {/* actions-слот: share-кнопка (share-links) добавится сюда после мержа
            через композицию страницы — без cross-feature импорта в слайсе forms. */}
        <div className="flex flex-wrap items-center gap-2">
          {canSeeSubmissions && form.id && (
            <Link
              href={`/forms/${form.id}/submissions`}
              className="text-sm text-(--color-link) hover:underline"
            >
              Отклики
            </Link>
          )}
          {canPublish && form.id && <FormPublishButton formId={form.id} />}
          {canDelete && form.id && <FormDeleteButton id={form.id} />}
        </div>
      </header>

      {/* Заполнение: показываем всем, кому форму отдали (бек уже пустил через
          CanSeeForm — auth/public/?token). Владелец тоже может откликнуться. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Заполнить</h2>
        <FormFill form={form} {...(token ? { token } : {})} />
      </section>

      {canEdit && (
        <section className="flex flex-col gap-4 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование структуры</h2>
          <p className="text-xs text-(--color-description)">
            Доступно только до публикации. После публикации структура замораживается.
          </p>
          <FormEditForm form={form} />
        </section>
      )}

      {isOwner && form.published_at && (
        <p className="text-xs text-(--color-description)">
          Форма опубликована — её структуру нельзя изменить.
        </p>
      )}
    </main>
  );
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const form = await getFormById(id, token);
  return { title: form?.title ?? "Форма" };
}
