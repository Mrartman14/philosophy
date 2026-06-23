// src/i18n/messages/zh/comments.ts
// Mirror of ru/comments.ts. Key parity enforced by satisfies Messages in zh/index.ts.
const comments = {
  // --- comment-type-badge ---
  type: {
    claim: "论点",
    grounds: "依据",
    rebuttal: "反驳",
    qualifier: "限定",
    question: "提问",
    answer: "回答",
    offtop: "离题",
    summary: "总结",
  },

  // --- comment-node-view ---
  deleted: "评论已删除",
  edited: "（已编辑）",

  // --- comment-tree-view / comment-tree ---
  empty: "暂无评论。",

  // --- comment-section ---
  sectionLabel: "评论",
  sectionHeading: "讨论",
  loginPrompt: "登录后即可发表评论。",
  unavailable: "评论暂时不可用。",
  searchFoundCount: "找到：{count}",
  noSnippet: "（无文本）",

  // --- comment-anchor-context ---
  anchor: {
    boundTo: "锚定到{entity}",
    document: "文档",
    glossary: "术语",
    comment: "评论",
    media: "媒体",
  },

  // --- comment-search ---
  searchPlaceholder: "搜索评论…",
  searchAriaLabel: "搜索讲座评论",
  searchButton: "搜索",
  searchPending: "…",

  // --- comment-create-form ---
  createTypeLabel: "评论类型",
  createTypeAriaLabel: "评论类型",
  createBodyLabel: "内容",
  createBodyAriaLabel: "评论内容",
  createSuccess: "评论已添加。",
  createSubmit: "提交",
  createForbiddenAction: "创建评论",

  // --- comment-edit-form ---
  editButton: "编辑",
  editBodyLabel: "内容",
  editBodyAriaLabel: "正在编辑评论",
  editSuccess: "已保存。",
  editSubmit: "保存",
  editCancel: "取消",
  editForbiddenAction: "编辑评论",

  // --- comment-reply-form ---
  replyButton: "回复",
  replyTypeLabel: "回复类型",
  replyTypeAriaLabel: "回复类型",
  replyBodyLabel: "回复内容",
  replyBodyAriaLabel: "回复内容",
  replySubmit: "回复",
  replyCancel: "取消",
  replyForbiddenAction: "回复",

  // --- comment-delete-button ---
  deleteButton: "删除",
  deleteDone: "已删除",
  deleteDialogTitle: "删除评论？",
  deleteDialogDescription:
    "此操作不可撤销。如果该评论有回复，它将变为“已删除”，但整个讨论串会保留。",
  deleteDialogConfirm: "删除",
  deleteForbiddenTitle: "无法删除",
  deleteFailureTitle: "无法删除",
  deleteAction: "删除评论",

  // --- comment-reactions ---
  reactionForbidden: "您没有进行反应的权限。",

  // --- lazy-ast-editor ---
  editorLoading: "正在加载编辑器…",

  // --- admin-comment-row ---
  adminDeleted: "已删除",

  // --- reactions.ts axis labels (catalog only — isomorphic boundary) ---
  axis: {
    agreement: "认同度",
    quality: "质量",
    insight: "洞见",
  },
  axisValueAria: {
    agreementPos: "认同",
    agreementNeg: "不认同",
    qualityPos: "质量高",
    qualityNeg: "质量低",
    insightMark: "标记为洞见",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadSchemaFailed: "无法加载评论结构",
    loadListFailed: "无法加载评论",
    loadSubtreeFailed: "无法加载讨论串",
    searchFailed: "搜索失败",
    loadRevisionsFailed: "无法加载修订",
    loadRevisionFailed: "无法加载修订",
    loadBlockFailed: "无法加载块",
  },
};

export default comments;
