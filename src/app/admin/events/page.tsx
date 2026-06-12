// src/app/admin/events/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { Pagination } from "@/components/ui";
import {
  canCreateEvent,
  canDeleteEvent,
  canReadEvents,
  canUpdateEvent,
  getAdminEvents,
  EventAdminRow,
  EventCreateForm,
} from "@/features/events";

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminEventsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canReadEvents(me)) forbidden();
  const canCreate = canCreateEvent(me);
  const canUpdate = canUpdateEvent(me);
  const canDelete = canDeleteEvent(me);

  const { offset } = await searchParams;
  const result = await getAdminEvents({
    offset: offset ? Number(offset) : 0,
    limit: 20,
  });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">События</h1>
        <p className="text-sm text-(--color-description)">
          Всего: {result.total}
        </p>
      </header>

      {canCreate && <EventCreateForm />}

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {result.items.map((event) => (
          <EventAdminRow
            key={event.id}
            event={event}
            canEdit={canUpdate}
            canDelete={canDelete}
          />
        ))}
      </ul>

      <Pagination
        basePath="/admin/events"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
      />
    </section>
  );
}

export const metadata = { title: "События — админ" };
