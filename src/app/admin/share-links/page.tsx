// src/app/admin/share-links/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  ShareLookupForm,
  ShareLinkList,
  getAdminShareLinksFor,
  canModerateShareLinks,
  ShareLinkLookupSchema,
} from "@/features/share-links";

interface Props {
  searchParams: Promise<{ resource_type?: string; resource_id?: string }>;
}

export default async function AdminShareLinksPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateShareLinks(me)) forbidden();

  const raw = await searchParams;
  const parsed = ShareLinkLookupSchema.safeParse(raw);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Модерация ссылок</h1>
        <p className="text-sm text-(--color-description)">
          Просмотр и отзыв любых share-ссылок. Укажите тип ресурса и его ID.
        </p>
      </header>

      <ShareLookupForm admin />

      {parsed.success ? (
        <ShareLinkList
          links={await getAdminShareLinksFor(
            parsed.data.resource_type,
            parsed.data.resource_id,
          )}
          resourceType={parsed.data.resource_type}
          resourceId={parsed.data.resource_id}
          admin
          showUrl={false}
        />
      ) : (
        <p className="text-sm text-(--color-description)">
          Укажите тип и ID ресурса выше.
        </p>
      )}
    </section>
  );
}

export const metadata = { title: "Модерация ссылок — админ" };
