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
