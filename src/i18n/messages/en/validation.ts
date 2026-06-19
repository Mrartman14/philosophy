// src/i18n/messages/en/validation.ts
// Зеркало ru/validation.ts. Паритет ключей форсит satisfies Messages.
const validation = {
  // --- reusable ---
  required: "Required field",
  maxLen: "Up to {n} characters",

  // --- preferences: push.SendRequest ---
  pushSend: {
    titleRequired: "Enter a title",
    titleMax: "Up to 200 characters",
    bodyMax: "Up to 1000 characters",
    urlFormat: 'URL must start with "/" or "http(s)://"',
  },
  // --- preferences: push subscribe/unsubscribe ---
  pushSubscribe: {
    endpoint: "Invalid subscription endpoint",
    p256dh: "Empty p256dh key",
    auth: "Empty auth key",
  },

  // --- auth: login ---
  login: {
    usernameRequired: "Enter username",
    usernameMax: "Username is too long",
    passwordRequired: "Enter password",
    passwordMax: "Password is too long",
  },

  // --- auth: register ---
  register: {
    usernameMin: "Username must be at least 3 characters",
    usernameMax: "Username must be at most 30 characters",
    passwordMin: "Password must be at least 6 characters",
    passwordMax: "Password is too long",
    passwordConfirmMismatch: "Passwords do not match",
  },

  // --- canvas: CanvasCreateSchema / CanvasUpdateSchema / CanvasIdSchema ---
  canvas: {
    titleRequired: "Enter a title",
    titleMax: "Up to 200 characters",
    invalidId: "Invalid canvas ID",
    badJson: "Invalid JSON in graph data",
    graphInvalid: "Graph failed validation",
    etagMissing: "Canvas version (ETag) is missing — refresh the page.",
    // CanvasDataSchema superRefine (node/edge structural errors)
    duplicateNodeId: "Duplicate node.id \"{id}\"",
    edgeFromNotFound: "Edge \"{edgeId}\": from_node \"{nodeId}\" not found",
    edgeToNotFound: "Edge \"{edgeId}\": to_node \"{nodeId}\" not found",
  },

  // --- comments: createComment / updateCommentBlocks form schemas ---
  comments: {
    invalidType: "Unknown comment type",
    invalidParentId: "Invalid parent_id",
    invalidCommentId: "Invalid comment id",
    blocksInvalidJson: "Invalid JSON in body",
    blocksNotArray: "Comment cannot be empty",
    blocksEmpty: "Comment cannot be empty",
  },
};

export default validation;
