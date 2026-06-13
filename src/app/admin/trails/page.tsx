// src/app/admin/trails/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { Pagination } from "@/components/ui";
import { parseNonNegativeInt } from "@/utils/paging";
import {
  canListAdminTrails,
  canAdminDeleteTrail,
  getAdminTrails,
  TrailAdminRow,
} from "@/features/trails";

export const metadata = { title: "Маршруты — админ" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminTrailsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canListAdminTrails(me)) forbidden();

  const { offset } = await searchParams;
  const result = await getAdminTrails({ offset: parseNonNegativeInt(offset, 0), limit: 20 });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Маршруты</h1>
        <p className="text-sm text-(--color-description)">
          Публичные маршруты. Всего: {result.total}
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {result.items.map((trail) => (
          <TrailAdminRow
            key={trail.id}
            trail={trail}
            canDelete={canAdminDeleteTrail(me, trail)}
          />
        ))}
      </ul>

      <Pagination
        basePath="/admin/trails"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
      />
    </section>
  );
}
