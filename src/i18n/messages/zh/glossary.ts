// src/i18n/messages/zh/glossary.ts
// Mirror of ru/glossary.ts (English literals). Key parity enforced by satisfies Messages.
const glossary = {
  // --- glossary-admin-row ---
  editButton: "编辑",

  // --- glossary-create-form ---
  titleLabel: "名称",
  titlePlaceholder: "例如：「认识论」",
  createButton: "创建",
  createTermAction: "创建术语",

  // --- glossary-delete-button ---
  deleteButton: "删除",
  deleteConfirmTitle: "删除术语？",
  deleteConfirmDescription:
    "此操作不可逆。如果其他内容引用了该术语的块，删除将被拒绝。",
  deleteConfirmLabel: "删除",
  deleteTermAction: "删除术语",

  // --- glossary-detail ---
  updatedAt: "更新于：{date}",

  // --- glossary-edit-form ---
  blocksLabel: "术语正文",
  savedMessage: "已保存。",
  saveButton: "保存",
  updateTermAction: "修改术语",

  // --- glossary-export-links ---
  exportLabel: "导出：",

  // --- glossary-list ---
  emptyState: "未找到术语。",
  totalCount: "共计：{count}",

  // --- glossary-revisions ---
  revisionsTitle: "术语修订历史",

  // --- glossary-search-form ---
  searchPlaceholder: "按名称搜索",
  searchButton: "查找",
  searchPending: "…",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "无法加载术语",
    loadItemFailed: "无法加载术语",
    loadRevisionsFailed: "无法加载术语修订",
    loadRevisionFailed: "无法加载术语修订",
  },
};

export default glossary;
