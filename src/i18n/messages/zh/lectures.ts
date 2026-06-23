// src/i18n/messages/zh/lectures.ts
// Mirror of ru/lectures.ts. Key parity enforced by satisfies Messages.
const lectures = {
  // --- UI-labels ---
  titleLabel: "标题",
  dateLabel: "日期",
  dateDescription: "格式为 YYYY-MM-DD",
  descriptionLabel: "描述",
  visibilityLabel: "可见性",
  visibilityPrivate: "私有",
  visibilityPublic: "公开",
  allTags: "全部标签",

  // --- buttons / actions ---
  saveButton: "保存",
  createButton: "创建",
  deleteButton: "删除",
  editLink: "编辑",
  searchButton: "查找",
  searchPending: "…",
  replaceCover: "替换封面",
  uploadCover: "上传封面",
  deleteCover: "删除封面",

  // --- cover form ---
  coverSectionLabel: "讲座封面",
  coverHeading: "封面",
  coverAlt: "讲座封面",
  coverEmpty: "未设置封面。",
  coverAltLabel: "替代文本（用于无障碍）",

  // --- delete dialog ---
  deleteDialogTitle: "删除讲座？",
  deleteDialogDescription: "此操作不可撤销。",

  // --- search form ---
  searchPlaceholder: "按标题或描述搜索",
  searchAriaLabel: "搜索讲座",
  tagFilterAriaLabel: "按标签筛选",

  // --- list empty state ---
  emptyTitle: "未找到讲座",
  emptyDescription: "请尝试修改筛选条件或搜索内容。",

  // --- edit form status ---
  savedMessage: "已保存。",

  // --- sections ---
  documentsSectionLabel: "讲座文档",
  documentsSectionHeading: "讲座文档",
  mediaSectionLabel: "讲座媒体",
  mediaSectionHeading: "讲座媒体",

  // --- attachments manager ---
  detachForbidden: "您没有取消关联的权限。",
  reorderForbidden: "您没有调整顺序的权限。",
  attachForbidden: "您没有添加关联的权限。",
  searchDocumentPlaceholder: "搜索文档…",
  searchMediaPlaceholder: "搜索媒体…",
  attachmentsEmpty: "暂无关联内容。",

  // --- forbidden actions (Case 3 — action phrase) ---
  coverForbiddenAction: "更改封面",
  visibilityForbiddenAction: "更改可见性",
  editForbiddenAction: "编辑",
  createAction: "创建讲座",
  deleteAction: "删除讲座",

  // --- server throws (api.ts fallback messages) ---
  api: {
    loadListFailed: "无法加载讲座列表",
    loadItemFailed: "无法加载讲座",
    loadDocumentsFailed: "无法加载讲座文档",
    loadMediaFailed: "无法加载讲座媒体",
  },
};

export default lectures;
