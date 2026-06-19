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

  // --- lectures: LectureCreateSchema / LectureUpdateSchema / etc. ---
  lectures: {
    titleRequired: "Enter a title",
    titleMax: "Up to 200 characters",
    descriptionMax: "Up to 5000 characters",
    dateFormat: "Date must be in YYYY-MM-DD format",
    invalidId: "Invalid lecture ID",
    imageRequired: "No image selected",
    altMax: "Up to 500 characters",
    entityRequired: "No entity selected",
    blocksMin: "At least one block is required",
  },

  // --- documents: DocumentCreateSchema / DocumentBlocksSchema / DocumentMetaSchema / etc. ---
  documents: {
    titleRequired: "Enter a title",
    titleMax: "Up to 500 characters",
    invalidId: "Invalid document ID",
    blocksMinLength: "Document body cannot be empty",
    blocksInvalidJson: "Invalid JSON in document body",
    blocksNotArray: "Body must be an array of blocks",
    blocksEmpty: "Add at least one block",
  },

  // --- banners: BannerFieldsSchema / BannerUpdateSchema / BannerIdSchema ---
  banners: {
    colorFormat: "Color must be a hex value like #RGB or #RRGGBB",
    audienceRequired: "Select an audience",
    dismissibleInvalid: 'Invalid value for "can be dismissed"',
    startAtRequired: "Specify the show start time",
    startAtInvalid: "Specify a valid date and time for show start",
    endAtInvalid: "Specify a valid date and time for show end",
    endAtBeforeStart: "Show end must be after show start",
    eventIdUuid: "Event ID must be a UUID",
    blocksInvalidJson: "Invalid JSON in the form body",
    blocksNotArray: "Body must be an array of blocks",
    invalidId: "Invalid banner ID",
  },

  // --- trails: TrailCreateSchema / TrailMetaSchema / TrailItemsSchema / TrailIdSchema ---
  trails: {
    titleRequired: "Enter a title",
    titleMax: "Up to 200 characters",
    descriptionMax: "Up to 2000 characters",
    invalidId: "Invalid trail ID",
    documentIdsRequired: "Document list is not set",
    documentIdsBadJson: "Invalid JSON in document list",
    documentIdsNotArray: "Document list must be an array",
    documentItemNotString: "List item is not a string",
    documentItemInvalidId: "Invalid document ID",
    documentItemDuplicate: "Document added twice",
  },

  // --- events: EventFieldsSchema / EventCreateSchema / EventUpdateSchema / EventIdSchema ---
  events: {
    titleRequired: "Enter a title",
    titleMax: "Up to 500 characters",
    startDateRequired: "Enter a start date",
    rruleMax: "Up to 500 characters",
    dateFormat: "Date format must be YYYY-MM-DD",
    startDateTimeRequired: "Enter a start date and time",
    endDateTimeRequired: "Enter an end date and time",
    endBeforeStart: "End date is before start date",
    rrulePrefix: "RRULE must start with FREQ=",
    blocksInvalidJson: "Invalid JSON in form body",
    blocksNotArray: "Body must be an array of blocks",
    invalidId: "Invalid event ID",
  },

  // --- annotations: AnnotationCreateSchema / AnnotationUpdateSchema ---
  annotations: {
    blocksMinLength: "Annotation body cannot be empty",
    blocksInvalidJson: "Invalid JSON in annotation body",
    blocksNotArray: "Body must be a non-empty array of blocks",
    blocksEmpty: "Body must be a non-empty array of blocks",
    anchorNotObject: "Anchor must be an object",
    anchorInvalidJson: "Invalid JSON in anchor",
    invalidParentId: "Invalid parent entity ID",
    invalidAnnotationId: "Invalid annotation ID",
    offsetMin: "offset >= 0",
  },

  // --- share-links: ExpiresAtSchema / ShareLinkCreateSchema / RevokeTokenSchema ---
  shareLinks: {
    invalidDate: "Invalid date",
    resourceIdRequired: "Enter resource ID",
    tokenRequired: "Token is required",
  },

  // --- users: UserRoleUpdateSchema / UserStatusUpdateSchema ---
  users: {
    invalidId: "Invalid user ID",
  },

  // --- media: MediaIdSchema / MediaVisibilitySchema ---
  media: {
    invalidId: "Invalid media ID",
  },

  // --- glossary: TermCreateSchema / TermBlocksUpdateSchema / TermIdSchema ---
  glossary: {
    titleRequired: "Enter a name",
    titleMax: "Up to 300 characters",
    invalidTermId: "Invalid term ID",
    blocksInvalidJson: "Invalid JSON in the form body",
    blocksNotArray: "Body must be an array of blocks",
  },

  // --- tags: TagCreateSchema / TagUpdateSchema / TagIdSchema / SetLectureTagsSchema ---
  tags: {
    nameRequired: "Enter a tag name",
    nameMax: "Up to 100 characters",
    invalidId: "Invalid tag ID",
    invalidLectureId: "Invalid lecture ID",
    tagIdsEmpty: "Empty tag_ids field",
    tagIdsInvalid: "tag_ids must be an array of positive integer IDs",
    tagIdsBadJson: "Invalid JSON in tag_ids",
  },

  // --- audit: log filters (AuditActorSchema / AuditActionSchema / AuditDateSchema) ---
  audit: {
    invalidActorUuid: "Invalid actor UUID",
    invalidActionFormat: "Format: domain.verb",
    invalidDate: "Invalid date",
  },

  // --- forms: form builder + response submission ---
  // --- search: SearchQuerySchema ---
  search: {
    queryRequired: "Enter a search query",
    queryMax: "Up to 200 characters",
  },

  forms: {
    invalidId: "Invalid identifier",
    titleRequired: "Enter a title",
    titleMax: "Up to 500 characters",
    promptRequired: "Question text is required",
    emptyOption: "Empty option",
    choiceRequiresOptions: "Add at least one option",
    optionsOnlyForChoice: "Options are only for choice fields",
    duplicateOptions: "Options must be unique",
    fieldsRequired: "Add at least one field",
    duplicateSortOrder: "Duplicate sort order for field #{n}",
    emptyPayload: "Empty form",
    badJsonPayload: "Invalid JSON in form",
    payloadStructureError: "Form structure error",
    visibilityRequired: "Visibility is required",
    modeRequired: "Mode is required",
    emptyAnswers: "No answers",
    badJsonAnswers: "Invalid JSON in answers",
    answersNotArray: "Answers must be an array",
    invalidAnswer: "Invalid answer",
  },
};

export default validation;
