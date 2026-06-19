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

  // --- documents slice: domain codes ---
  DOCUMENT_PUBLIC_IMMUTABLE: "A public document cannot be made private.",
  DOCUMENT_REFERENCED:
    "Other content references this document. Remove the references and try again.",
  DOCUMENT_BLOCK_REFERENCED:
    "An external reference points to a block in this document. Remove it or keep the block.",
  DOCUMENT_BLOCKS_HAVE_ANCHORS:
    "Can't delete a block that has anchored comments. Remove the comments first.",
  DOCUMENT_BLOCKS_EMPTY: "The document must contain at least one block.",
  DOCUMENT_BLOCKS_INVALID: "The document body failed AST validation.",
  DOCUMENT_BLOCK_ID_UNKNOWN: "Block ID error. Please reload the editor.",
  DOCUMENT_DUPLICATE_BLOCK_ID: "Block ID error. Please reload the editor.",
  DOCUMENT_IMAGE_UNKNOWN_KEY: "The document contains an image with an unknown key.",

  // --- canvas slice: domain codes ---
  PUBLIC_IMMUTABLE: "A public canvas cannot be made private.",
  CANVAS_VERSION_MISMATCH:
    "The canvas was changed elsewhere — refresh the page and try again.",
  CANVAS_PAYLOAD_TOO_LARGE: "Graph data is too large (limit 1 MiB).",
  CANVAS_VALIDATION_ERROR:
    "Graph failed validation (nodes/edges/entity references).",

  // --- banners slice: domain codes ---
  BANNER_INVALID_COLOR:
    "The backend rejected the background color: must be a hex value like #RGB or #RRGGBB.",
  BANNER_INVALID_DATE:
    "The backend rejected the show dates: check the format and the start/end order.",
  BANNER_INVALID_EVENT: "No event found with this ID.",
  BANNER_BLOCKS_INVALID: "The banner text failed AST validation.",
  BANNER_BLOCK_REFERENCED:
    "Other content references a block in this banner. Remove the references or keep the block.",
  BANNER_NOT_DISMISSIBLE: "This banner cannot be dismissed.",

  // --- lectures slice: domain codes ---
  UPLOAD_NOT_FOUND: "Uploaded image not found. Please try again.",
  ALREADY_ATTACHED: "This entity is already attached to the lecture.",
  INVALID_ENTITY_TYPE: "Invalid entity type.",
  // NOT_FOUND — generic backend code; not added to the global catalog to prevent
  // isErrorKey from treating it as a catalog key for all slices.
  // The lectures slice maps NOT_FOUND → LECTURE_NOT_FOUND in its ERRORS map.
  LECTURE_NOT_FOUND: "Lecture not found.",

  // --- events slice: domain codes ---
  INVALID_DATE:
    "The backend rejected the date: check the format and the start/end date order.",
  INVALID_RRULE: "The backend rejected the recurrence rule (RRULE).",
  EVENT_BLOCKS_INVALID: "The event description failed AST validation.",
  EVENT_BLOCK_REFERENCED:
    "Other content references a block in this event. Remove the references or keep the block.",

  // --- trails slice: domain codes ---
  TRAIL_PUBLIC_IMMUTABLE: "A public trail cannot be made private — you can only delete it.",
  TRAIL_DUPLICATE_DOCUMENT: "A document was added to the trail twice. Remove the duplicate.",
  TRAIL_DOCUMENT_NOT_FOUND: "One of the documents was not found. Update the list and try again.",

  // --- media slice: domain codes ---
  MEDIA_PUBLIC_IMMUTABLE:
    "Public media cannot be made private. Delete it and upload again.",
  MEDIA_NOT_FOUND: "Media not found.",

  // --- share-links slice: domain codes ---
  NOT_FOUND: "Resource not found or you are not its owner.",
  RESOURCE_NOT_PRIVATE: "A share link can only be created for a private resource.",

  // --- annotations slice: domain codes ---
  ANNOTATION_BLOCKS_EMPTY: "The annotation body cannot be empty.",
  ANNOTATION_BLOCKS_INVALID: "The annotation body failed AST validation.",
  ANNOTATION_ANCHOR_INVALID: "Invalid annotation anchor.",
  ANNOTATION_INVALID_PARENT_TYPE: "Annotations are not available for this entity type.",
  ANNOTATION_REQUEST_BODY_TOO_LARGE: "The annotation is too large.",

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
