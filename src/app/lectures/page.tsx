// src/app/lectures/page.tsx
import { getLectures, LectureList, LectureSearchForm } from "@/features/lectures";
import { Pagination } from "@/components/ui";

export const metadata = { title: "Лекции" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function pickInt(v: string | string[] | undefined): number | undefined {
  const s = pickString(v);
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function LecturesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = pickString(sp.q);
  const tag = pickString(sp.tag);
  const offset = pickInt(sp.offset) ?? 0;
  const limit = pickInt(sp.limit) ?? 20;

  const filter: Parameters<typeof getLectures>[0] = { offset, limit };
  if (q) filter.q = q;
  if (tag) filter.tag = tag;

  const { items, total } = await getLectures(filter);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Лекции</h1>
      <LectureSearchForm basePath="/lectures" />
      <LectureList items={items} />
      {total > limit && (
        <Pagination basePath="/lectures" offset={offset} limit={limit} total={total} />
      )}
    </div>
  );
}
