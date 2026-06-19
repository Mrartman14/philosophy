// src/i18n/messages/en/errors.ts
// Зеркало ru/errors.ts (английские литералы). Паритет ключей форсит satisfies Messages.
const errors = {
  // --- api-error: backend codes (DEFAULT_MESSAGES) ---
  REF_NOT_FOUND: "One of the references points to a missing object.",
  BLOCKS_HAVE_ANCHORS:
    "Can't delete a block that has anchored comments. Remove the comments or keep the block.",
  VERSION_MISMATCH:
    "The object was changed elsewhere. Refresh the page and try again.",
  IF_MATCH_REQUIRED:
    "Couldn't determine the object version. Refresh the page and try again.",
  IDEMPOTENCY_KEY_IN_USE:
    "The request is already being processed. Please wait, don't resend.",
  IDEMPOTENCY_KEY_REUSED:
    "A changed request conflicts with one already sent. Refresh the page.",
  IDEMPOTENCY_KEY_INVALID:
    "Invalid idempotency key. Refresh the page and try again.",

  // --- comments slice: domain codes ---
  SELF_REACTION: "You can't react to your own comment.",
  AXIS_NOT_ALLOWED: "This reaction is not available for this comment type.",
  INVALID_INSIGHT_VALUE: "The Insight reaction is only available with a positive value.",
  COMMENT_DELETED: "Comment has been deleted.",
  PARENT_NOT_AVAILABLE: "The parent comment is not available.",
  PARENT_WRONG_LECTURE: "The parent comment is not available.",
  INVALID_ROOT_TYPE: "This comment type cannot be used as a root.",
  INVALID_TYPE_FOR_PARENT:
    "This comment type is not allowed as a reply to the selected node.",
  MAX_DEPTH_EXCEEDED: "Maximum thread depth exceeded.",
  BLOCKS_EMPTY: "Comment cannot be empty.",
  BLOCKS_INVALID: "Comment body failed AST validation.",
  BLOCK_ID_UNKNOWN: "Block ID error. Please reload the editor.",
  DUPLICATE_BLOCK_ID: "Block ID error. Please reload the editor.",
  COMMENT_REFERENCED:
    "Other content references this comment. Remove the references first.",
  BLOCK_REFERENCED:
    "An external reference points to a block in this comment. Remove it first.",
  // BLOCKS_HAVE_ANCHORS for comments differs from the default (document/glossary context):
  BLOCKS_HAVE_ANCHORS_COMMENT:
    "Other comments are anchored to this comment's blocks. Detach them first.",

  // --- forms slice: domain codes ---
  FORM_PUBLISHED: "The form is published — its structure cannot be changed.",
  FORM_PUBLIC_IMMUTABLE: "A public form cannot be made private again.",
  MODE_CHANGE_FORBIDDEN: "The immutable mode cannot be switched to editable.",
  FORM_IMMUTABLE_MODE:
    "This form does not allow editing or deleting a response — only retracting.",
  RETRACT_NOT_APPLICABLE: "Retraction is only available for forms without response editing.",
  ALREADY_SUBMITTED: "You have already submitted a response to this form.",
  ALREADY_RETRACTED: "The response has already been retracted.",
  INVALID_FORM_SCHEMA: "The form structure failed server-side validation.",
  INVALID_SUBMISSION: "The answers failed validation. Please fill in all required fields correctly.",
  FORM_NOT_FOUND: "Form not found.",
  SUBMISSION_NOT_FOUND: "Response not found.",
  FORM_BLOCKS_INVALID: "The form description failed validation.",

  // --- canvas slice: domain codes ---
  PUBLIC_IMMUTABLE: "A public canvas cannot be made private.",
  CANVAS_VERSION_MISMATCH:
    "The canvas was changed elsewhere — refresh the page and try again.",
  CANVAS_PAYLOAD_TOO_LARGE: "Graph data is too large (limit 1 MiB).",
  CANVAS_VALIDATION_ERROR:
    "Graph failed validation (nodes/edges/entity references).",

  // --- lectures slice: domain codes ---
  UPLOAD_NOT_FOUND: "Uploaded image not found. Please try again.",
  ALREADY_ATTACHED: "This entity is already attached to the lecture.",
  INVALID_ENTITY_TYPE: "Invalid entity type.",
  NOT_FOUND: "Lecture not found.",
  LECTURE_NOT_FOUND: "Lecture not found.",

  // --- api-error: rethrowApiError fallbacks ---
  serverError: "Server error",
  accountRestricted: "Account restricted.",

  // --- branded forbidden/suspended ---
  // {action} — the action phrase, e.g. "deleting the lecture".
  forbiddenAction: "You don't have permission for {action}.",
  forbiddenGeneric: "You don't have permission.",
  forbiddenTitle: "No permission",
  failureTitle: "Error",
  unknown: "Unknown error",
};

export default errors;
