// src/i18n/messages/en/forms.ts
// Mirror of ru/forms.ts. Key parity enforced by satisfies Messages.
const forms = {
  // --- field-kinds: field type labels ---
  fieldType: {
    text: "Short text",
    long_text: "Long text",
    single_choice: "Single choice",
    multi_choice: "Multiple choice",
    number: "Number",
    date: "Date",
  },

  // --- form-meta: status labels ---
  visibility: {
    private: "Private",
    public: "Public",
    // *Lower — lowercase variant for mid-sentence interpolation
    // (my-forms-list: "Visibility: {privateLower}"). Intentional convention.
    privateLower: "private",
    publicLower: "public",
  },
  submissionMode: {
    editable: "Response can be edited or deleted",
    immutable: "Response can only be retracted",
    // *Lower — lowercase variant for mid-sentence interpolation
    // (my-forms-list: "Mode: {editableLower}"). Intentional convention.
    editableLower: "editable",
    immutableLower: "immutable",
  },
  publishedBadge: "Published",
  publishedSuffix: " · published",
  draftSuffix: " · draft",

  // --- form-detail: fallback title ---
  untitled: "Form",
  untitledForm: "Untitled",

  // --- form-after-submit ---
  afterSubmitTitle: "After submission",

  // --- form-builder ---
  builder: {
    titleLabel: "Form title",
    descriptionLabel: "Description (markdown, optional)",
    afterSubmitLabel: "Text after submission (markdown, optional)",
    visibilityLabel: "Visibility",
    visibilityPrivate: "Private",
    visibilityPublic: "Public (publish immediately)",
    submissionModeLabel: "Response mode",
    submissionModeEditable: "Editable (responses can be changed or deleted)",
    submissionModeImmutable: "Immutable (responses can only be retracted)",
    submissionModeHint:
      "The immutable mode cannot be relaxed later. A public form cannot be made private again, and its structure cannot be changed.",
    addField: "+ Add field",
  },

  // --- form-builder-field-row ---
  fieldRow: {
    heading: "Field #{index}",
    ariaUp: "Move up",
    ariaDown: "Move down",
    ariaRemove: "Remove",
    typeLabel: "Field type",
    promptLabel: "Question text (markdown)",
    helpLabel: "Hint (optional, markdown)",
    requiredLabel: "Required field",
    optionsLabel: "Options",
    optionPlaceholder: "Option {index}",
    ariaRemoveOption: "Remove option",
    addOption: "+ Option",
  },

  // --- form-create-form / form-edit-form: buttons ---
  createSubmit: "Create form",
  editSubmit: "Save structure",

  // --- form-delete-button / form-admin-row ---
  deleteFormLabel: "Delete form",
  deleteFormTitle: "Delete form?",
  deleteFormDescriptionAdmin: "The public form and all its responses will be deleted. This action is irreversible.",
  deleteFormDescription: "This action is irreversible. All responses to this form will be deleted.",
  deleteConfirm: "Delete",

  // --- form-publish-button ---
  publishButton: "Publish",
  publishTitle: "Publish form?",
  publishDescription:
    "Once published, the form cannot be made private again, and its structure cannot be changed. Active share links will stop working.",
  publishConfirm: "Publish",

  // --- form-fill ---
  submitSuccessMessage: "Response submitted. Thank you!",
  requiredFieldsTitle: "Fill in required fields",
  requiredFieldsDescription: "Not all required fields have been filled in.",
  submitButton: "Submit response",
  submittingButton: "Submitting…",

  // --- submission-actions ---
  deleteSubmissionButton: "Delete response",
  retractSubmissionButton: "Retract response",
  deleteSubmissionTitle: "Delete response?",
  retractSubmissionTitle: "Retract response?",
  deleteSubmissionDescription: "The response will be deleted. You will be able to fill in the form again.",
  retractSubmissionDescription: "Retraction is irreversible: you will not be able to submit a response to this form again.",
  deleteSubmissionConfirm: "Delete",
  retractSubmissionConfirm: "Retract",

  // --- submission-detail ---
  submissionRetracted: "Response retracted — answers deleted.",

  // --- submission-edit-form ---
  saveButton: "Save changes",
  savingButton: "Saving…",

  // --- my-forms-list ---
  noForms: "You don't have any forms yet.",

  // --- my-submissions-list ---
  noSubmissions: "You don't have any responses yet.",
  submissionRetractedLabel: "retracted",
  formLinkPrefix: "Form {id}",

  // --- submission-list ---
  noSubmissionsAdmin: "No responses yet.",
  submissionLinkPrefix: "Response {id}",

  // --- toastActionError actions (phrase for errors.forbiddenAction) ---
  fillAction: "submitting the response",
  submissionEditAction: "editing the response",
  publishAction: "publishing the form",
  deleteFormAction: "deleting the form",
  deleteSubmissionAction: "deleting the response",
  retractSubmissionAction: "retracting the response",

  // --- toastActionError failureTitle overrides ---
  fillFailureTitle: "Couldn't submit",
  submissionEditFailureTitle: "Couldn't save",

  // --- forbiddenAction per-feature phrases (for FormFeedback.forbiddenAction) ---
  editFormForbiddenAction: "editing the form",
  createFormForbiddenAction: "creating the form",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadItemFailed: "Failed to load form",
    loadMyFailed: "Failed to load forms",
    loadMySubmissionsFailed: "Failed to load responses",
    loadSubmissionsFailed: "Failed to load responses",
    loadSubmissionFailed: "Failed to load response",
    loadAdminFailed: "Failed to load forms",
    loadStatsFailed: "Failed to load form statistics",
    loadFieldAnswersFailed: "Failed to load field answers",
  },
};

export default forms;
