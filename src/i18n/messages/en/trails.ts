// src/i18n/messages/en/trails.ts
// Mirror of ru/trails.ts. Key parity is enforced by satisfies Messages.
const trails = {
  // --- trail-create-form ---
  createTitleLabel: "Title",
  createTitlePlaceholder: "Trail title",
  createDescriptionLabel: "Description",
  createDescriptionPlaceholder: "Short description (optional)",
  createVisibilityLabel: "Visibility",
  createVisibilityPrivate: "Private",
  createVisibilityPublic: "Public",
  createVisibilityNote: "A public trail cannot be made private again — you can only delete it.",
  createSubmit: "Create",
  createForbiddenAction: "creating the trail",

  // --- trail-meta-form ---
  metaTitleLabel: "Title",
  metaDescriptionLabel: "Description",
  metaSubmit: "Save",
  metaSaved: "Saved.",

  // --- trail-delete-button ---
  deleteButton: "Delete",
  deleteDialogTitle: "Delete trail?",
  deleteDialogDescription: "This action is irreversible. Lectures in the trail will not be deleted — only the trail itself.",
  deleteDialogConfirm: "Delete",
  deleteAction: "trail deletion",
  deleteForbiddenTitle: "Could not delete",
  deleteFailureTitle: "Could not delete",

  // --- trail-items-editor ---
  itemsHeading: "Trail contents",
  itemsEmpty: "The trail is empty. Add documents.",
  itemsMoveUp: "Move up",
  itemsMoveDown: "Move down",
  itemsRemove: "Remove",
  itemsPickerCancel: "Cancel",
  itemsAddDocument: "+ Add document",
  itemsSaveSubmit: "Save contents",
  itemsSavedTitle: "Saved",
  itemsSavedDescription: "Trail contents updated.",
  itemsErrorTitle: "Error",
  itemsAlreadyAddedTitle: "Already added",
  itemsAlreadyAddedDescription: "This document is already in the trail.",
  itemsForbiddenAction: "trail modification",
  itemsValidationError: "Please check the document list.",

  // --- trail-visibility-button ---
  visibilityMakePublic: "Make public",
  visibilityForbiddenAction: "changing visibility",

  // --- trail-detail ---
  detailDocumentsHeading: "Trail documents",
  detailDocumentsEmpty: "No documents in this trail yet.",

  // --- trail-my-list ---
  myListEmpty: "You don't have any trails yet.",
  myListUntitled: "Untitled",
  visibilityPrivate: "private",
  visibilityPublic: "public",

  // --- trail-public-list ---
  publicListEmpty: "No trails yet.",
  publicListUntitled: "Untitled",

  // --- trail-admin-row ---
  adminUntitled: "Untitled",
  adminAuthorLabel: "author",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Failed to load trails",
    loadItemFailed: "Failed to load trail",
  },
};

export default trails;
