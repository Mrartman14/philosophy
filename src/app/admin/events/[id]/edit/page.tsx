// src/app/admin/events/[id]/edit/page.tsx
import { forbidden, notFound } from "next/navigation";

import { SchemaContextProvider } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import {
  canDeleteEvent,
  canReadEvents,
  canUpdateEvent,
  getAdminEventById,
  EventDeleteButton,
  EventEditForm,
  EventExportLinks,
  EventRevisions,
} from "@/features/events";
import { getMe } from "@/utils/me";

export const metadata = { title: "События — редактирование" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}

export default async function AdminEventEditPage({
  params,
  searchParams,
}: Props) {
  const me = await getMe();
  if (!canReadEvents(me)) forbidden();
  const canUpdate = canUpdateEvent(me);
  const canDelete = canDeleteEvent(me);

  const { id } = await params;
  const { revision } = await searchParams;
  const event = await getAdminEventById(id);
  if (!event) notFound();

  const astSchema = canUpdate ? await getAstSchema() : null;

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        {event.id && <EventExportLinks id={event.id} />}
      </header>

      {canUpdate && (
        <SchemaContextProvider initial={astSchema ?? undefined}>
          <EventEditForm event={event} />
        </SchemaContextProvider>
      )}

      {/* Ревизионные эндпоинты бек гейтит на event.update — секция видна
          по тому же чеку. */}
      {canUpdate && event.id && (
        <EventRevisions eventId={event.id} selectedRevisionId={revision} />
      )}

      {canDelete && event.id && (
        <div>
          <EventDeleteButton id={event.id} />
        </div>
      )}
    </section>
  );
}
