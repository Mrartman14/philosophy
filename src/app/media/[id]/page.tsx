// src/app/media/[id]/page.tsx
import { notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  MediaDetail,
  canDeleteMedia,
  canChangeMediaVisibility,
  getMediaById,
  getMediaContainers,
} from "@/features/media";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const media = await getMediaById(id);
  return { title: media ? media.filename : "Медиа" };
}

export default async function MediaPage({ params }: Props) {
  const { id } = await params;
  const [me, media] = await Promise.all([getMe(), getMediaById(id)]);
  // Secure-by-obscurity: «не видно» ≡ «не существует».
  if (!media) notFound();

  const containers = await getMediaContainers(id);

  const canDelete = canDeleteMedia(me, media);
  const canChangeVisibility = canChangeMediaVisibility(me, media);
  // Admin-удаление: есть право удалять, но это не его медиа (для текста диалога).
  const isAdminDelete = canDelete && !!me && media.owner_id !== me.id;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <MediaDetail
        media={media}
        containers={containers}
        canDelete={canDelete}
        canChangeVisibility={canChangeVisibility}
        isAdminDelete={isAdminDelete}
      />
    </main>
  );
}
