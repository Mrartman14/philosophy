// src/app/documents/new/page.tsx
import { forbidden } from "next/navigation";

import { ChevronIcon } from "@/assets/icons/chevron-icon";
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { RouterLink } from "@/components/ui";
import {
  canCreateDocument,
  DocumentCreateForm,
  DocumentUploadForm,
} from "@/features/documents";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("createDocumentTitle") };
}

export default async function NewDocumentPage() {
  // Создание документа — приватная зона: гостя на логин.
  const me = await requireActiveUserOrRedirect("/documents/new");
  if (!canCreateDocument(me)) forbidden();

  const astSchema = await getAstSchema();
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("createDocumentHeading")}</h1>
        <RouterLink href="/me/documents" className="inline-flex items-center gap-1 text-sm text-(--color-link)">
          <ChevronIcon className="rtl-flip rotate-180" />
          {t("createDocumentBack")}
        </RouterLink>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("createDocumentEditorSection")}</h2>
        <SchemaContextProvider initial={astSchema}>
          <DocumentCreateForm />
        </SchemaContextProvider>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("myDocumentsUpload")}</h2>
        <DocumentUploadForm />
      </section>
    </div>
  );
}
