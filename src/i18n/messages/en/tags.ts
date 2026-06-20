// src/i18n/messages/en/tags.ts
// Mirror of ru/tags.ts — English literals. Key parity enforced by satisfies Messages.
const tags = {
  // --- UI: tag-create-form ---
  newTagLabel: "New tag",
  namePlaceholder: "E.g. «ethics»",
  tagCreated: "Tag «{name}» created.",
  create: "Create",
  createTagAction: "creating a tag",

  // --- UI: tag-admin-row ---
  rename: "Rename",
  cancel: "Cancel",
  newNameLabel: "New name",
  save: "Save",
  renameTagAction: "renaming the tag",

  // --- UI: tag-delete-button ---
  delete: "Delete",
  deleteTitle: "Delete tag «{name}»?",
  deleteDescription: "The tag will be removed from all lectures. This action is irreversible.",
  deleteTagAction: "deleting the tag",

  // --- UI: lecture-tags-form ---
  noTagsHint: "No tags yet. Create them on the Tags page in the admin panel.",
  saveTags: "Save tags",
  tagsSaved: "Tags saved.",
  assignTagsAction: "assigning tags",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Failed to load tags",
    loadLectureTagsFailed: "Failed to load lecture tags",
  },
};

export default tags;
