// src/i18n/messages/en/editor.ts
// UI strings for the AST editor component (mirror of ru/editor.ts).
const editor = {
  // --- Editor (use-ast-editor) ---
  editorAriaLabel: "AST Editor",

  // --- Schema context (schema-context) ---
  schemaUnavailable: "AST schema unavailable: {message}",

  // --- Image node view (image-node-view) ---
  imageLoading: "Image is loading",

  // --- Toolbar: inline marks (inline-marks) ---
  bold: "Bold",
  italic: "Italic",
  code: "Code",

  // --- Toolbar: block buttons (block-buttons) ---
  blockquote: "Blockquote",
  codeBlock: "Code block",
  thematicBreak: "Horizontal rule",
  table: "Table",

  // --- Toolbar: list buttons (list-buttons) ---
  bulletList: "Bulleted list",
  orderedList: "Numbered list",
  checkList: "Checklist",

  // --- Toolbar: heading select (heading-select) ---
  blockTypeAriaLabel: "Block type",
  paragraph: "Paragraph",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  heading4: "Heading 4",
  heading5: "Heading 5",
  heading6: "Heading 6",

  // --- Toolbar: link popover (link-popover) ---
  linkAriaLabel: "Link",
  linkUrlAriaLabel: "Link URL",
  linkInvalidScheme: "Invalid link scheme (http, https, mailto are allowed)",
  linkRemove: "Remove link",
  linkApply: "Apply",

  // --- Toolbar: ref popover (ref-popover) ---
  insertRefAriaLabel: "Insert entity reference",

  // --- Toolbar: image button (image-button) ---
  imageAriaLabel: "Image",
  imageUploadFailTitle: "Failed to upload image",
  imageUploadFailGeneric: "An error occurred. Please try again.",
  imageUploadForbidden: "You don't have permission to upload images.",
  imageUploadTooLarge: "Image is too large (max 10 MiB)",
  imageUploadInvalidMime: "Unsupported file format",
  imageUploadNetworkError: "Network error",
  imageUploadNoAccess: "Access denied",
  imageUploadFailed: "Upload error: {status}",

  // --- Toolbar: slash menu (slash-menu) ---
  slashMenuAriaLabel: "Block commands",
  slashMenuNoMatches: "No matches",
  slashMenuClose: "Esc — close",
  slashMenuHeading: "Heading {level}",
  slashMenuBlockquote: "Blockquote",
  slashMenuCodeBlock: "Code block",
  slashMenuBulletList: "Bulleted list",
  slashMenuOrderedList: "Numbered list",
  slashMenuThematicBreak: "Divider",
  slashMenuTable: "Table 3×3",

  // --- Ref menu (ref-menu) ---
  insertRefDialogAriaLabel: "Insert reference",
  refCategoryLecture: "Lecture",
  refCategoryGlossary: "Term",
  refCategoryDocument: "Document",
  refCategoryMedia: "Media",
  refCategoryComment: "Comment",

  // --- Async combobox (async-combobox) ---
  comboboxEmpty: "Nothing found",
  comboboxError: "Load error",
  comboboxLoading: "Loading…",
  comboboxRetry: "Retry",
  comboboxLoadMore: "Load more",

  // --- Pickers: placeholders ---
  lecturePlaceholder: "Search lectures…",
  glossaryPlaceholder: "Search terms…",
  documentPlaceholder: "Search documents…",
  mediaPlaceholder: "Search media…",
  canvasPlaceholder: "Search canvas…",
  commentPlaceholder: "Search comments in the selected lecture…",

  // --- Picker: error messages from server actions ---
  lecturesLoadError: "Failed to load lectures",
  glossaryLoadError: "Failed to load glossary",
  documentsLoadError: "Failed to load documents",
  mediaLoadError: "Failed to load media",
  canvasLoadError: "Failed to load canvas",
  commentsLoadError: "Failed to load comments",

  // --- Media picker (media-picker) ---
  mediaTypeLabel: "Type",
  mediaTypeAll: "all",
  mediaTypeVideo: "video",
  mediaTypeAudio: "audio",

  // --- Comment 2-stage picker (comment-2stage-picker) ---
  commentPickerStep1: "Step 1: select a lecture",
  commentPickerStep2: "Step 2: select a comment",
  commentPickerChangeLecture: "← Change lecture",

  // --- Schema server (schema-server) ---
  schemaLoadError: "Failed to load AST editor schema",
};

export default editor;
