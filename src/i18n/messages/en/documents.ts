// src/i18n/messages/en/documents.ts
// Mirror of ru/documents.ts. Key parity enforced by satisfies Messages.
const documents = {
  // --- UI-labels (shared) ---
  titleLabel: "Title",
  contentLabel: "Content",
  visibilityLabel: "Visibility",
  visibilityPrivate: "Private",
  visibilityPublic: "Public",
  titlePlaceholder: "Document title",
  fileLabel: "Markdown file (.md)",
  noTitle: "Untitled",

  // --- visibility warning ---
  publicWarning:
    "A public document cannot be made private again — it can only be deleted.",

  // --- buttons ---
  createButton: "Create",
  saveContentButton: "Save content",
  saveTitleButton: "Save title",
  uploadButton: "Upload",
  makePublicButton: "Make public",
  deleteButton: "Delete",

  // --- saved/status ---
  savedMessage: "Saved.",

  // --- empty states ---
  emptyDocument: "Document is empty.",
  emptyMyList: "You have no documents yet.",

  // --- admin row ---
  authorLabel: "author",

  // --- containers panel ---
  containersPanelTitle: "Included in lectures",
  containersEmpty: "This document is not included in any lecture.",
  containerLinkLabel: "Lecture {id}",

  // --- delete dialog ---
  deleteDialogTitle: "Delete document?",
  deleteDialogDescription:
    "This action is irreversible. If the document is referenced by other content, the deletion will be rejected.",
  deleteDialogConfirm: "Delete",

  // --- forbidden actions (Case 3: action phrase for errors.forbiddenAction) ---
  editForbiddenAction: "editing the document",
  visibilityForbiddenAction: "changing the visibility",
  createAction: "creating a document",
  uploadAction: "uploading a document",
  deleteAction: "deleting the document",

  // --- conflict merge (AstMergeView) ---
  merge: {
    title: "Document changed elsewhere",
    intro:
      "While you were editing, another user saved this document. Merge the changes block by block.",
    badgeServerChanged: "changed on server",
    badgeYourEdit: "your edit",
    badgeAddedByYou: "added by you",
    badgeAddedOnServer: "added on server",
    badgeRemovedByYou: "removed by you",
    badgeRemovedOnServer: "removed on server",
    conflictHeading: "Conflict — choose a block version",
    optionServer: "Server version",
    optionMine: "Your version",
    acceptDeletion: "Accept deletion",
    contentChanged: "content changed",
    unchangedLabel: "blocks unchanged",
    showUnchanged: "Show unchanged blocks",
    hideUnchanged: "Hide unchanged blocks",
    applyButton: "Apply and continue",
    cancelButton: "Cancel",
    takeServerButton: "Discard my changes, take server",
    goneMessage:
      "The document was deleted elsewhere. Copy your edits and reload the page.",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadMyFailed: "Failed to load documents",
    loadItemFailed: "Failed to load document",
    loadContainersFailed: "Failed to load attachments",
    loadRevisionsFailed: "Failed to load revisions",
    loadRevisionFailed: "Failed to load revision",
    loadAdminFailed: "Failed to load documents",
  },
};

export default documents;
