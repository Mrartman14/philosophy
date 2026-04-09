import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

export function canEditTranscript(me: MaybeMe): boolean {
  return can(me, "transcript.edit");
}
