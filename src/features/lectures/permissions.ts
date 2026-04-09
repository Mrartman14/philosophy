import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

export function canCreateLecture(me: MaybeMe): boolean {
  return can(me, "lecture.create");
}

export function canUpdateLecture(me: MaybeMe): boolean {
  return can(me, "lecture.update");
}

export function canDeleteLecture(me: MaybeMe): boolean {
  return can(me, "lecture.delete");
}

export function canUploadLectureFiles(me: MaybeMe): boolean {
  return can(me, "lecture.upload_files");
}
