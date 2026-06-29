// src/features/media/index.ts
export {
  getMyMedia,
  getMediaById,
  getMediaContainers,
  getAdminMedia,
} from "./api";
export type { MyMediaFilter, MyMediaResult, AdminMediaResult } from "./api";

export { deleteMedia, setMediaVisibility } from "./actions";
export { uploadMedia } from "./upload-media";

export {
  canCreateMedia,
  canDeleteAnyMedia,
  canDeleteMedia,
  canChangeMediaVisibility,
  canModerateMedia,
} from "./permissions";

export { MediaGrid } from "./ui/media-grid";
export { MediaCard } from "./ui/media-card";
export { MediaUploadForm } from "./ui/media-upload-form";
export { MediaDetail } from "./ui/media-detail";
export { MediaPlayer } from "./ui/media-player";
export { MediaAdminRow } from "./ui/media-admin-row";
export { MediaAdminFilterForm } from "./ui/media-admin-filter-form";

export type { Media, MediaSummary, FileType, Visibility, MediaAttachment } from "./types";
