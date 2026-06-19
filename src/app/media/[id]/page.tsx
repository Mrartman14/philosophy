// src/app/media/[id]/page.tsx
import { notFound } from "next/navigation";

import { AnnotationsSection } from "@/features/annotations";
import {
  MediaDetail,
  canDeleteMedia,
  canChangeMediaVisibility,
  getMediaById,
  getMediaContainers,
} from "@/features/media";
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [media, t] = await Promise.all([getMediaById(id), getT("pages")]);
  return { title: media ? media.filename : t("mediaDefaultTitle") };
}

export default async function MediaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const [me, media] = await Promise.all([getMe(), getMediaById(id, token)]);
  // Secure-by-obscurity: «не видно» ≡ «не существует».
  if (!media) notFound();

  const containers = await getMediaContainers(id);

  const canDelete = canDeleteMedia(me, media);
  const canChangeVisibility = canChangeMediaVisibility(me, media);
  // Admin-удаление: есть право удалять, но это не его медиа (для текста диалога).
  const isAdminDelete = canDelete && !!me && media.owner_id !== me.id;

  const canShare = canCreateShareLink(me, media);
  const shareLinks = canShare
    ? await getShareLinksFor("media", media.id)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      {canShare && (
        <div className="flex justify-end">
          <ShareButton
            resourceType="media"
            resourceId={media.id}
            canCreate={canShare}
            initialLinks={shareLinks}
          />
        </div>
      )}

      <MediaDetail
        media={media}
        containers={containers}
        canDelete={canDelete}
        canChangeVisibility={canChangeVisibility}
        isAdminDelete={isAdminDelete}
      />

      {/* Аннотации на медиа (media-якорь по времени). Композиция через
          страницу: AnnotationsSection из index.ts слайса annotations. */}
      {media.id && (
        <AnnotationsSection parentEntityType="media" parentId={media.id} />
      )}
    </div>
  );
}
