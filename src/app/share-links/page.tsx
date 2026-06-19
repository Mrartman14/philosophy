// src/app/share-links/page.tsx
import {
  ShareLookupForm,
  ShareLinkList,
  getShareLinksFor,
  ShareLinkLookupSchema,
} from "@/features/share-links";
import { requireActiveUserOrRedirect } from "@/utils/me";

interface Props {
  searchParams: Promise<{ resource_type?: string; resource_id?: string }>;
}

export default async function MyShareLinksPage({ searchParams }: Props) {
  await requireActiveUserOrRedirect("/share-links");

  const raw = await searchParams;
  const parsed = ShareLinkLookupSchema.safeParse(raw);

  return (
    <section className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Мои ссылки</h1>
        <p className="text-sm text-(--color-fg-muted)">
          Управление share-ссылками. Выберите тип ресурса и укажите его ID,
          чтобы увидеть выпущенные ссылки.
        </p>
      </header>

      <ShareLookupForm />

      {parsed.success ? (
        <ShareLinkList
          links={await getShareLinksFor(
            parsed.data.resource_type,
            parsed.data.resource_id,
          )}
          resourceType={parsed.data.resource_type}
          resourceId={parsed.data.resource_id}
        />
      ) : (
        <p className="text-sm text-(--color-fg-muted)">
          Укажите тип и ID ресурса выше.
        </p>
      )}
    </section>
  );
}

export const metadata = { title: "Мои ссылки" };
