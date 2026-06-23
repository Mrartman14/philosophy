// src/i18n/messages/zh/documents.ts
// Mirror of ru/documents.ts. Key parity enforced by satisfies Messages.
const documents = {
  // --- UI-labels (shared) ---
  titleLabel: "标题",
  contentLabel: "内容",
  visibilityLabel: "可见性",
  visibilityPrivate: "私有",
  visibilityPublic: "公开",
  titlePlaceholder: "文档标题",
  fileLabel: "Markdown 文件（.md）",
  noTitle: "无标题",

  // --- visibility warning ---
  publicWarning: "公开文档无法重新设为私有，只能删除。",

  // --- buttons ---
  createButton: "创建",
  saveContentButton: "保存内容",
  saveTitleButton: "保存标题",
  uploadButton: "上传",
  makePublicButton: "设为公开",
  deleteButton: "删除",

  // --- saved/status ---
  savedMessage: "已保存。",

  // --- empty states ---
  emptyDocument: "文档为空。",
  emptyMyList: "你还没有任何文档。",

  // --- admin row ---
  authorLabel: "作者",

  // --- containers panel ---
  containersPanelTitle: "已包含于讲座",
  containersEmpty: "该文档未包含在任何讲座中。",
  containerLinkLabel: "讲座 {id}",

  // --- delete dialog ---
  deleteDialogTitle: "删除文档？",
  deleteDialogDescription:
    "此操作不可逆。如果该文档被其他材料引用，删除将被拒绝。",
  deleteDialogConfirm: "删除",

  // --- forbidden actions (Case 3: action phrase for errors.forbiddenAction) ---
  editForbiddenAction: "修改文档",
  visibilityForbiddenAction: "修改可见性",
  createAction: "创建文档",
  uploadAction: "上传文档",
  deleteAction: "删除文档",

  // --- conflict merge (AstMergeView) ---
  merge: {
    title: "文档已在其他位置被修改",
    intro:
      "在你编辑期间，另一位用户保存了该文档。请逐块合并修改。",
    badgeServerChanged: "服务器上已修改",
    badgeYourEdit: "你的修改",
    badgeAddedByYou: "由你添加",
    badgeAddedOnServer: "在服务器上添加",
    badgeRemovedByYou: "由你删除",
    badgeRemovedOnServer: "在服务器上删除",
    conflictHeading: "冲突 — 请选择块的版本",
    optionServer: "服务器版本",
    optionMine: "你的版本",
    acceptDeletion: "接受删除",
    contentChanged: "内容已修改",
    unchangedLabel: "个未修改的块",
    showUnchanged: "显示未修改的块",
    hideUnchanged: "隐藏未修改的块",
    applyButton: "应用并继续",
    cancelButton: "取消",
    takeServerButton: "放弃我的修改，采用服务器版本",
    goneMessage:
      "该文档已在其他位置被删除。请复制你的修改并刷新页面。",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadMyFailed: "加载文档失败",
    loadItemFailed: "加载文档失败",
    loadContainersFailed: "加载关联项失败",
    loadRevisionsFailed: "加载修订失败",
    loadRevisionFailed: "加载修订失败",
    loadAdminFailed: "加载文档失败",
  },
};

export default documents;
