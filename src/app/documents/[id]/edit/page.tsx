// src/app/documents/[id]/edit/page.tsx
import { forbidden, notFound } from "next/navigation";

import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { RouterLink } from "@/components/ui";
import {
  canEditDocument,
  getDocumentById,
  DocumentMetaForm,
  DocumentEditForm,
  DocumentVisibilityButton,
} from "@/features/documents";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DocumentEditPage({ params }: Props) {
  const { id } = await params;
  const [me, document] = await Promise.all([getMe(), getDocumentById(id)]);
  if (!document) notFound();
  if (!canEditDocument(me, document)) forbidden();

  const isPrivateOwned = document.visibility === "private";
  const astSchema = await getAstSchema();
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("documentEditHeading")}</h1>
        <RouterLink href={`/documents/${id}`} className="text-sm text-(--color-link)">
          {t("documentEditBack")}
        </RouterLink>
      </header>

      <DocumentMetaForm document={document} />
      <SchemaContextProvider initial={astSchema}>
        <DocumentEditForm document={document} />
      </SchemaContextProvider>
      {isPrivateOwned && document.id && (
        <DocumentVisibilityButton id={document.id} />
      )}
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [document, t] = await Promise.all([getDocumentById(id), getT("pages")]);
  return {
    title: document?.filename
      ? t("documentEditMetaTitleFull", { filename: document.filename })
      : t("documentEditMetaTitleFallback"),
  };
}
