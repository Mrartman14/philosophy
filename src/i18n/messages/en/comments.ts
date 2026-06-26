// src/i18n/messages/en/comments.ts
// Mirror of ru/comments.ts. Key parity enforced by satisfies Messages in en/index.ts.
const comments = {
  // --- comment-type-badge ---
  type: {
    claim: "Claim",
    grounds: "Grounds",
    rebuttal: "Rebuttal",
    qualifier: "Qualifier",
    question: "Question",
    answer: "Answer",
    offtop: "Off-topic",
    summary: "Summary",
  },

  // --- comment-node-view ---
  deleted: "Comment deleted",
  edited: "(edited)",

  // --- comment-tree-view / comment-tree ---
  empty: "No comments yet.",

  // --- comment-section ---
  sectionLabel: "Comments",
  sectionHeading: "Discussion",
  loginPrompt: "Log in to leave a comment.",
  unavailable: "Comments are temporarily unavailable.",
  searchFoundCount: "Found: {count}",
  noSnippet: "(no text)",

  // --- comment-anchor-context ---
  anchor: {
    boundTo: "Anchored to {entity}",
    document: "document",
    glossary: "term",
    comment: "comment",
    media: "media",
  },

  // --- comment-search ---
  searchPlaceholder: "Search comments…",
  searchAriaLabel: "Search lecture comments",
  searchButton: "Search",
  searchPending: "…",

  // --- comment-create-form ---
  createTypeLabel: "Comment type",
  createTypeAriaLabel: "Comment type",
  createBodyLabel: "Text",
  createBodyAriaLabel: "Comment text",
  createSuccess: "Comment added.",
  createSubmit: "Submit",
  createForbiddenAction: "creating a comment",

  // --- comment-edit-form ---
  editButton: "Edit",
  editBodyLabel: "Text",
  editBodyAriaLabel: "Editing comment",
  editSuccess: "Saved.",
  editSubmit: "Save",
  editCancel: "Cancel",
  editForbiddenAction: "editing a comment",

  // --- comment-reply-form ---
  replyButton: "Reply",
  replyTypeLabel: "Reply type",
  replyTypeAriaLabel: "Reply type",
  replyBodyLabel: "Reply text",
  replyBodyAriaLabel: "Reply text",
  replySubmit: "Reply",
  replyCancel: "Cancel",
  replyForbiddenAction: "replying",

  // --- comment-delete-button ---
  deleteButton: "Delete",
  deleteDone: "Deleted",
  deleteDialogTitle: "Delete comment?",
  deleteDialogDescription:
    "This action is irreversible. If the comment has replies, it will become 'deleted' but the thread will remain.",
  deleteDialogConfirm: "Delete",
  deleteForbiddenTitle: "Could not delete",
  deleteFailureTitle: "Could not delete",
  deleteAction: "deleting a comment",

  // --- comment-reactions ---
  reactionForbidden: "You don't have permission to react.",

  // --- lazy-ast-editor ---
  editorLoading: "Loading editor…",

  // --- admin-comment-row ---
  adminDeleted: "deleted",

  // --- margin comments (selection marginalia UI) ---
  marginCommentAdd: "Comment",
  marginComposerTitle: "Comment on selection",
  marginOpenThread: "Open thread",
  marginColumnLabel: "Comments on selections",
  marginOrphanLabel: "Fragment not found",

  // --- reactions.ts axis labels (catalog only — isomorphic boundary) ---
  axis: {
    agreement: "Agreement",
    quality: "Quality",
    insight: "Insight",
  },
  axisValueAria: {
    agreementPos: "agree",
    agreementNeg: "disagree",
    qualityPos: "high quality",
    qualityNeg: "low quality",
    insightMark: "mark as insight",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadSchemaFailed: "Failed to load comment schema",
    loadListFailed: "Failed to load comments",
    loadSubtreeFailed: "Failed to load thread",
    searchFailed: "Search failed",
    loadRevisionsFailed: "Failed to load revisions",
    loadRevisionFailed: "Failed to load revision",
    loadBlockFailed: "Failed to load block",
  },
};

export default comments;
