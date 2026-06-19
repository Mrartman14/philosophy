// src/app/lectures/page.tsx
import { Pagination } from "@/components/ui";
import { getLectures, LectureList, LectureSearchForm } from "@/features/lectures";
import { getLectureTags, getTags } from "@/features/tags";
import { getT } from "@/i18n";
import { parsePaging } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("lecturesTitle") };
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function LecturesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = pickString(sp.q);
  const tag = pickString(sp.tag);
  const { offset, limit } = parsePaging({ offset: sp.offset, limit: sp.limit }, { limit: 20 });

  const filter: Parameters<typeof getLectures>[0] = { offset, limit };
  if (q) filter.q = q;
  if (tag) filter.tag = tag;

  const { items, total } = await getLectures(filter);

  // Теги для фильтра и карточек. Батч-эндпоинта нет — по запросу на лекцию
  // текущей страницы (≤ limit, публичные GET, дешёвые). См. план tags, §решения.
  const [allTags, tagsEntries] = await Promise.all([
    getTags(),
    Promise.all(
      items.map(async (l) => [l.id, await getLectureTags(l.id)] as const),
    ),
  ]);
  const tagsByLectureId = Object.fromEntries(tagsEntries);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">{t("lecturesHeading")}</h1>
      <LectureSearchForm
        basePath="/lectures"
        tagOptions={allTags.items.map((t) => t.name)}
      />
      <LectureList items={items} tagsByLectureId={tagsByLectureId} />
      {total > limit && (
        <Pagination basePath="/lectures" offset={offset} limit={limit} total={total} searchParams={sp} />
      )}
    </div>
  );
}
