// src/app/documents/my/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import { SchemaContextProvider } from "@/components/ast-editor";
import {
  canCreateDocument,
  getMyDocuments,
  DocumentCreateForm,
  DocumentUploadForm,
  DocumentMyList,
} from "@/features/documents";

export const metadata = { title: "Мои документы" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyDocumentsPage({ searchParams }: Props) {
  const me = await getMe();
  // Документы — приватная зона: гостя отправляем на логин.
  if (!me || me.status !== "active") redirect("/login?next=/documents/my");

  const { offset } = await searchParams;
  const result = await getMyDocuments({ offset: offset ? Number(offset) : 0, limit: 20 });
  const canCreate = canCreateDocument(me);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Мои документы</h1>
        <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
      </header>

      {canCreate && (
        <section className="flex flex-col gap-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Создать документ
            </summary>
            <div className="mt-3">
              <SchemaContextProvider>
                <DocumentCreateForm />
              </SchemaContextProvider>
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Загрузить .md
            </summary>
            <div className="mt-3">
              <DocumentUploadForm />
            </div>
          </details>
        </section>
      )}

      <DocumentMyList documents={result.items} />
    </main>
  );
}
