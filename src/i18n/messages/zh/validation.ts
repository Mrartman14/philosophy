// src/i18n/messages/zh/validation.ts
// Зеркало ru/validation.ts. Паритет ключей форсит satisfies Messages.
const validation = {
  // --- reusable ---
  required: "必填项",
  maxLen: "最多 {n} 个字符",

  // --- shared messages used across multiple forms ---
  common: {
    // "Enter a title" — canvas/lectures/documents/trails/events/forms
    titleRequired: "请输入标题",
    // "Body must be an array of blocks" — documents/banners/events/glossary
    blocksNotArray: "正文必须是块数组",
    // "Invalid date" — shareLinks/audit
    invalidDate: "日期无效",
  },

  // --- preferences: push.SendRequest ---
  pushSend: {
    titleRequired: "请输入标题",
    titleMax: "最多 200 个字符",
    bodyMax: "最多 1000 个字符",
    urlFormat: 'URL 必须以 "/" 或 "http(s)://" 开头',
  },
  // --- preferences: push subscribe/unsubscribe ---
  pushSubscribe: {
    endpoint: "订阅 endpoint 无效",
    p256dh: "p256dh 密钥为空",
    auth: "auth 密钥为空",
  },

  // --- auth: login ---
  login: {
    usernameRequired: "请输入登录名",
    usernameMax: "登录名过长",
    passwordRequired: "请输入密码",
    passwordMax: "密码过长",
  },

  // --- auth: register ---
  register: {
    usernameMin: "登录名至少 3 个字符",
    usernameMax: "登录名最多 30 个字符",
    passwordMin: "密码至少 6 个字符",
    passwordMax: "密码过长",
    passwordConfirmMismatch: "两次输入的密码不一致",
  },

  // --- canvas: CanvasCreateSchema / CanvasUpdateSchema / CanvasIdSchema ---
  canvas: {
    titleMax: "最多 200 个字符",
    invalidId: "画布 ID 无效",
    badJson: "图谱数据中的 JSON 无效",
    graphInvalid: "图谱未通过验证",
    etagMissing: "画布版本（ETag）缺失——请刷新页面。",
    // CanvasDataSchema superRefine (node/edge structural errors)
    duplicateNodeId: "node.id \"{id}\" 重复",
    edgeFromNotFound: "边 \"{edgeId}\"：未找到 from_node \"{nodeId}\"",
    edgeToNotFound: "边 \"{edgeId}\"：未找到 to_node \"{nodeId}\"",
  },

  // --- comments: createComment / updateCommentBlocks form schemas ---
  comments: {
    invalidType: "未知的评论类型",
    invalidParentId: "parent_id 无效",
    invalidCommentId: "评论 id 无效",
    blocksInvalidJson: "正文中的 JSON 无效",
    blocksNotArray: "评论不能为空",
    blocksEmpty: "评论不能为空",
    anchorNotObject: "锚点必须是对象",
    anchorInvalidJson: "锚点中的 JSON 无效",
  },

  // --- lectures: LectureCreateSchema / LectureUpdateSchema / etc. ---
  lectures: {
    titleMax: "最多 200 个字符",
    descriptionMax: "最多 5000 个字符",
    dateFormat: "日期必须为 YYYY-MM-DD 格式",
    invalidId: "讲座 ID 无效",
    imageRequired: "未选择图片",
    altMax: "最多 500 个字符",
    entityRequired: "未选择实体",
    blocksMin: "至少需要一个块",
  },

  // --- documents: DocumentCreateSchema / DocumentBlocksSchema / DocumentMetaSchema / etc. ---
  documents: {
    titleMax: "最多 500 个字符",
    invalidId: "文档 ID 无效",
    blocksMinLength: "文档正文不能为空",
    blocksInvalidJson: "文档正文中的 JSON 无效",
    blocksEmpty: "请至少添加一个块",
  },

  // --- banners: BannerFieldsSchema / BannerUpdateSchema / BannerIdSchema ---
  banners: {
    colorFormat: "颜色必须是 #RGB 或 #RRGGBB 形式的十六进制值",
    audienceRequired: "请选择受众",
    dismissibleInvalid: '"可关闭"的取值无效',
    startAtRequired: "请指定展示开始时间",
    startAtInvalid: "请指定有效的展示开始日期和时间",
    endAtInvalid: "请指定有效的展示结束日期和时间",
    endAtBeforeStart: "展示结束时间必须晚于开始时间",
    eventIdUuid: "活动 ID 必须是 UUID",
    blocksInvalidJson: "表单正文中的 JSON 无效",
    invalidId: "横幅 ID 无效",
  },

  // --- trails: TrailCreateSchema / TrailMetaSchema / TrailItemsSchema / TrailIdSchema ---
  trails: {
    titleMax: "最多 200 个字符",
    descriptionMax: "最多 2000 个字符",
    invalidId: "路径 ID 无效",
    documentIdsRequired: "未设置文档列表",
    documentIdsBadJson: "文档列表中的 JSON 无效",
    documentIdsNotArray: "文档列表必须是数组",
    documentItemNotString: "列表项不是字符串",
    documentItemInvalidId: "文档 ID 无效",
    documentItemDuplicate: "文档被重复添加",
  },

  // --- events: EventFieldsSchema / EventCreateSchema / EventUpdateSchema / EventIdSchema ---
  events: {
    titleMax: "最多 500 个字符",
    startDateRequired: "请输入开始日期",
    rruleMax: "最多 500 个字符",
    dateFormat: "日期格式必须为 YYYY-MM-DD",
    startDateTimeRequired: "请输入开始日期和时间",
    endDateTimeRequired: "请输入结束日期和时间",
    endBeforeStart: "结束日期早于开始日期",
    rrulePrefix: "RRULE 必须以 FREQ= 开头",
    blocksInvalidJson: "表单正文中的 JSON 无效",
    invalidId: "活动 ID 无效",
  },

  // --- annotations: AnnotationCreateSchema / AnnotationUpdateSchema ---
  annotations: {
    blocksMinLength: "批注正文不能为空",
    blocksInvalidJson: "批注正文中的 JSON 无效",
    blocksNotArray: "正文必须是非空的块数组",
    blocksEmpty: "正文必须是非空的块数组",
    anchorNotObject: "锚点必须是对象",
    anchorInvalidJson: "锚点中的 JSON 无效",
    invalidParentId: "父实体 ID 无效",
    invalidAnnotationId: "批注 ID 无效",
    offsetMin: "offset >= 0",
  },

  // --- share-links: ExpiresAtSchema / ShareLinkCreateSchema / RevokeTokenSchema ---
  shareLinks: {
    resourceIdRequired: "请输入资源 ID",
    tokenRequired: "令牌为必填项",
  },

  // --- users: UserRoleUpdateSchema / UserStatusUpdateSchema ---
  users: {
    invalidId: "用户 ID 无效",
  },

  // --- media: MediaIdSchema / MediaVisibilitySchema ---
  media: {
    invalidId: "媒体 ID 无效",
  },

  // --- glossary: TermCreateSchema / TermBlocksUpdateSchema / TermIdSchema ---
  glossary: {
    titleRequired: "请输入名称",
    titleMax: "最多 300 个字符",
    invalidTermId: "术语 ID 无效",
    blocksInvalidJson: "无法处理术语正文。请刷新页面后重试。",
    blocksMinLength: "请为术语添加描述。",
    blocksEmpty: "请为术语添加描述。",
  },

  // --- tags: TagCreateSchema / TagUpdateSchema / TagIdSchema / SetLectureTagsSchema ---
  tags: {
    nameRequired: "请输入标签名称",
    nameMax: "最多 100 个字符",
    invalidId: "标签 ID 无效",
    invalidLectureId: "讲座 ID 无效",
    tagIdsEmpty: "tag_ids 字段为空",
    tagIdsInvalid: "tag_ids 必须是正整数 ID 的数组",
    tagIdsBadJson: "tag_ids 中的 JSON 无效",
  },

  // --- audit: log filters (AuditActorSchema / AuditActionSchema / AuditDateSchema) ---
  audit: {
    invalidActorUuid: "操作者 UUID 无效",
    invalidActionFormat: "格式：domain.verb",
  },

  // --- search: SearchQuerySchema ---
  search: {
    queryRequired: "请输入搜索内容",
    queryMax: "最多 200 个字符",
  },

  // --- tokens: CreateTokenSchema ---
  tokens: {
    labelRequired: "请输入名称",
    labelMax: "最多 100 个字符",
    expiresInt: "请输入整数天数",
    expiresMin: "至少 1 天",
    expiresMax: "最多 90 天",
  },

  // --- forms: form builder + response submission ---
  forms: {
    invalidId: "标识符无效",
    titleMax: "最多 500 个字符",
    promptRequired: "问题文本为必填项",
    emptyOption: "选项为空",
    choiceRequiresOptions: "请至少添加一个选项",
    optionsOnlyForChoice: "选项仅用于选择字段",
    duplicateOptions: "选项不能重复",
    fieldsRequired: "请至少添加一个字段",
    duplicateSortOrder: "字段 #{n} 的排序重复",
    emptyPayload: "表单为空",
    badJsonPayload: "表单的 JSON 无效",
    payloadStructureError: "表单结构错误",
    visibilityRequired: "未指定可见性",
    modeRequired: "未指定模式",
    emptyAnswers: "没有答案",
    badJsonAnswers: "答案的 JSON 无效",
    answersNotArray: "答案必须是数组",
    invalidAnswer: "答案无效",
  },
};

export default validation;
