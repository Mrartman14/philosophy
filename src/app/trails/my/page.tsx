// src/app/trails/my/page.tsx
import { redirect } from "next/navigation";

import {
  canCreateTrail,
  getMyTrails,
  TrailCreateForm,
  TrailMyList,
} from "@/features/trails";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export const metadata = { title: "Мои маршруты" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyTrailsPage({ searchParams }: Props) {
  const me = await getMe();
  // Маршруты «мои» — приватная зона: гостя на логин.
  if (me?.status !== "active") redirect("/login?next=/trails/my");

  const { offset } = await searchParams;
  const result = await getMyTrails({ offset: parseNonNegativeInt(offset, 0), limit: 20 });
  const canCreate = canCreateTrail(me);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Мои маршруты</h1>
        <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
      </header>

      {canCreate && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Создать маршрут</summary>
          <div className="mt-3">
            <TrailCreateForm />
          </div>
        </details>
      )}

      <TrailMyList trails={result.items} />
    </div>
  );
}
