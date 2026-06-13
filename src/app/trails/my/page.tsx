// src/app/trails/my/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canCreateTrail,
  getMyTrails,
  TrailCreateForm,
  TrailMyList,
} from "@/features/trails";

export const metadata = { title: "Мои маршруты" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyTrailsPage({ searchParams }: Props) {
  const me = await getMe();
  // Маршруты «мои» — приватная зона: гостя на логин.
  if (!me || me.status !== "active") redirect("/login?next=/trails/my");

  const { offset } = await searchParams;
  const result = await getMyTrails({ offset: offset ? Number(offset) : 0, limit: 20 });
  const canCreate = canCreateTrail(me);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
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
    </main>
  );
}
