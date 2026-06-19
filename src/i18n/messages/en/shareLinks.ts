// src/i18n/messages/en/shareLinks.ts
// Mirror of ru/shareLinks.ts (English literals). Key parity is enforced by satisfies Messages.
const shareLinks = {
  // --- resource types ---
  resourceTypes: {
    lecture: "Lecture",
    document: "Document",
    trail: "Trail",
    media: "Media",
    form: "Form",
    canvas: "Canvas",
  },

  // --- copy-button ---
  copyDefault: "Copy",
  copiedLabel: "Copied ✓",
  copiedToast: "Copied",
  copyFailTitle: "Failed to copy",
  copyFailDesc: "Select the link and copy it manually.",

  // --- share-button ---
  shareButtonLabel: "Share",
  shareDialogTitle: "Share: {type}",
  shareDialogDesc: "The link opens the private resource for the holder without sign-in.",
  expiresAtLabel: "Expiry date (optional)",
  createLinkButton: "Create link",
  linkCreatedToast: "Link created",

  // --- share-link-list ---
  statusActive: "Active",
  statusExpired: "Expired",
  statusRevoked: "Revoked",
  emptyTitle: "No links",
  emptyDesc: "No share links have been issued for this resource yet.",
  colStatus: "Status",
  colLink: "Link",
  colToken: "Token",
  colCreated: "Created",
  colExpires: "Expires",
  colAction: "Action",
  urlAriaLabel: "Share URL",
  revokeButton: "Revoke",
  revokedToast: "Link revoked",

  // --- share-lookup-form ---
  resourceTypeLabel: "Resource type",
  resourceIdLabel: "Resource ID",
  resourceIdPlaceholder: "Resource UUID",
  showLinksButton: "Show links",
};

export default shareLinks;
