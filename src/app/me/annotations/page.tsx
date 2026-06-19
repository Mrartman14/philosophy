// src/app/me/annotations/page.tsx
import { Pagination } from "@/components/ui";
import {
  getMyAnnotations,
  AnnotationCard,
  AnnotationAnchorContext,
  AnnotationExportLinks,
  AnnotationDeleteButton,
} from "@/features/annotations";
import { getT } from "@/i18n";
import { requireUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("myAnnotationsTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

const LIMIT = 20;

export default async function MyAnnotationsPage({ searchParams }: Props) {
  await requireUserOrRedirect("/me/annotations");

  const sp = await searchParams;
  const offset = parseNonNegativeInt(sp.offset, 0);
  const { items, total } = await getMyAnnotations(offset, LIMIT);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t("myAnnotationsHeading")}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">
          {t("myAnnotationsEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <AnnotationCard
                annotation={a}
                anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
                actions={
                  <>
                    {a.id && <AnnotationExportLinks id={a.id} />}
                    {a.id && <AnnotationDeleteButton annotationId={a.id} />}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/me/annotations" offset={offset} limit={LIMIT} total={total} searchParams={sp} />
    </div>
  );
}
