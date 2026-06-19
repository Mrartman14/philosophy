// src/app/me/documents/page.tsx
import { SchemaContextProvider } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import {
  canCreateDocument,
  getMyDocuments,
  DocumentCreateForm,
  DocumentUploadForm,
  DocumentMyList,
} from "@/features/documents";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("myDocumentsTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyDocumentsPage({ searchParams }: Props) {
  // Документы — приватная зона: гостя отправляем на логин.
  const me = await requireActiveUserOrRedirect("/me/documents");

  const { offset } = await searchParams;
  const result = await getMyDocuments({ offset: parseNonNegativeInt(offset, 0), limit: 20 });
  const canCreate = canCreateDocument(me);
  const astSchema = canCreate ? await getAstSchema() : null;
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">{t("myDocumentsHeading")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("myDocumentsTotal", { total: result.total })}</p>
      </header>

      {canCreate && (
        <section className="flex flex-col gap-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              {t("myDocumentsCreate")}
            </summary>
            <div className="mt-3">
              <SchemaContextProvider initial={astSchema ?? undefined}>
                <DocumentCreateForm />
              </SchemaContextProvider>
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              {t("myDocumentsUpload")}
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
