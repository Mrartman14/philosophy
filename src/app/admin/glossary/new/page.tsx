import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { ChevronIcon } from "@/assets/icons/chevron-icon";
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { RouterLink } from "@/components/ui";
import { canCreateTerm, GlossaryCreateForm } from "@/features/glossary";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("glossaryNewMetaTitle") };
}

export default async function AdminGlossaryNewPage() {
  const me = await getMe();
  if (!canCreateTerm(me)) forbidden();

  const astSchema = await getAstSchema();
  const t = await getT("admin");

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("glossaryNewHeading")}</h1>
        <RouterLink
          href="/admin/glossary"
          className="inline-flex items-center gap-1 text-sm text-(--color-link)"
        >
          <ChevronIcon className="rtl-flip rotate-180" />
          {t("glossaryNewBack")}
        </RouterLink>
      </header>

      <SchemaContextProvider initial={astSchema}>
        <GlossaryCreateForm />
      </SchemaContextProvider>
    </section>
  );
}
