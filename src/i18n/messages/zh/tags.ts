// src/i18n/messages/zh/tags.ts
// Mirror of ru/tags.ts — Simplified Chinese literals. Key parity enforced by satisfies Messages.
const tags = {
  // --- UI: tag-create-form ---
  newTagLabel: "新建标签",
  namePlaceholder: "例如：「伦理学」",
  tagCreated: "标签「{name}」已创建。",
  createButton: "创建",
  createTagAction: "创建标签",

  // --- UI: tag-admin-row ---
  rename: "重命名",
  cancel: "取消",
  newNameLabel: "新名称",
  saveButton: "保存",
  renameTagAction: "重命名标签",

  // --- UI: tag-delete-button ---
  deleteButton: "删除",
  deleteTitle: "删除标签「{name}」？",
  deleteDescription: "该标签将从所有讲座中移除。此操作不可撤销。",
  deleteTagAction: "删除标签",

  // --- UI: lecture-tags-form ---
  noTagsHint: "暂无标签。请在管理面板的「标签」页面创建。",
  saveTags: "保存标签",
  tagsSaved: "标签已保存。",
  assignTagsAction: "分配标签",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "加载标签失败",
    loadLectureTagsFailed: "加载讲座标签失败",
  },
};

export default tags;
