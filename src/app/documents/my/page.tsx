// src/app/documents/my/page.tsx
import { SchemaContextProvider } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import {
  canCreateDocument,
  getMyDocuments,
  DocumentCreateForm,
  DocumentUploadForm,
  DocumentMyList,
} from "@/features/documents";
import { requireActiveUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export const metadata = { title: "Мои документы" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyDocumentsPage({ searchParams }: Props) {
  // Документы — приватная зона: гостя отправляем на логин.
  const me = await requireActiveUserOrRedirect("/documents/my");

  const { offset } = await searchParams;
  const result = await getMyDocuments({ offset: parseNonNegativeInt(offset, 0), limit: 20 });
  const canCreate = canCreateDocument(me);
  const astSchema = canCreate ? await getAstSchema() : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
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
              <SchemaContextProvider initial={astSchema ?? undefined}>
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
    </div>
  );
}
