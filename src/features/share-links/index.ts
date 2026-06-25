// src/features/share-links/index.ts
// Public API слайса share-links. Снаружи слайс импортируется только отсюда.

export { getShareLinksFor, getAdminShareLinksFor } from "./api";
export {
  canCreateShareLink,
  canModerateShareLinks,
  canManageOwnLinks,
  type ShareableResource,
} from "./permissions";
export { buildShareUrl } from "./share-url";
export {
  type ShareLink,
  type ResourceType,
  SHARE_RESOURCE_TYPES,
  ALL_RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
} from "./types";
export { ShareLinkLookupSchema, type ShareLinkLookupInput } from "./schemas";
export { ShareButton } from "./ui/share-button";
export { ShareDialog } from "./ui/share-dialog";
export { ShareLinkList } from "./ui/share-link-list";
export { ShareLookupForm } from "./ui/share-lookup-form";
