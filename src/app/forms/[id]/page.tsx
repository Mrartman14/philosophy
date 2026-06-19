// src/app/forms/[id]/page.tsx
import { notFound } from "next/navigation";

import { RouterLink } from "@/components/ui";
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
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function FormPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const [me, form] = await Promise.all([getMe(), getFormById(id, token)]);
  if (!form) notFound();

  const isOwner = !!me && me.status === "active" && me.id === form.owner_id;
  const canEdit = canEditForm(me, form);
  const canPublish = canPublishForm(me, form);
  const canDelete = canDeleteForm(me, form);
  const canSeeSubmissions = canListFormSubmissions(me, form);

  const canShare = canCreateShareLink(me, form);
  const shareLinks =
    canShare && form.id ? await getShareLinksFor("form", form.id) : [];
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-3">
        <FormDetail form={form} />
        {/* actions-слот: share-кнопка (share-links) — композиция через страницу,
            без cross-feature импорта в слайсе forms. */}
        <div className="flex flex-wrap items-center gap-2">
          {form.id && (
            <ShareButton
              resourceType="form"
              resourceId={form.id}
              canCreate={canShare}
              initialLinks={shareLinks}
            />
          )}
          {canSeeSubmissions && form.id && (
            <RouterLink
              href={`/forms/${form.id}/submissions`}
              className="text-sm text-(--color-link) hover:underline"
            >
              {t("formSubmissionsLink")}
            </RouterLink>
          )}
          {canPublish && form.id && <FormPublishButton formId={form.id} />}
          {canDelete && form.id && <FormDeleteButton id={form.id} />}
        </div>
      </header>

      {/* Заполнение: показываем всем, кому форму отдали (бек уже пустил через
          CanSeeForm — auth/public/?token). Владелец тоже может откликнуться. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("formFillSection")}</h2>
        <FormFill form={form} {...(token ? { token } : {})} />
      </section>

      {canEdit && (
        <section className="flex flex-col gap-4 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">{t("formEditSection")}</h2>
          <p className="text-xs text-(--color-fg-muted)">
            {t("formEditHint")}
          </p>
          <FormEditForm form={form} />
        </section>
      )}

      {isOwner && form.published_at && (
        <p className="text-xs text-(--color-fg-muted)">
          {t("formPublishedNote")}
        </p>
      )}
    </div>
  );
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const [form, t] = await Promise.all([getFormById(id, token), getT("pages")]);
  return { title: form?.title ?? t("formDefaultTitle") };
}
