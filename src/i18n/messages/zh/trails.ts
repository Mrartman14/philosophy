// src/i18n/messages/zh/trails.ts
// Mirror of ru/trails.ts. Key parity is enforced by satisfies Messages.
const trails = {
  // --- trail-create-form ---
  createTitleLabel: "标题",
  createTitlePlaceholder: "路径标题",
  createDescriptionLabel: "描述",
  createDescriptionPlaceholder: "简短描述（可选）",
  createVisibilityLabel: "可见性",
  createVisibilityPrivate: "私有",
  createVisibilityPublic: "公开",
  createVisibilityNote: "公开路径无法再改回私有——只能删除。",
  createSubmit: "创建",
  createForbiddenAction: "创建路径",

  // --- trail-meta-form ---
  metaTitleLabel: "标题",
  metaDescriptionLabel: "描述",
  metaSubmit: "保存",
  metaSaved: "已保存。",
  metaForbiddenAction: "编辑路径",

  // --- trail-delete-button ---
  deleteButton: "删除",
  deleteDialogTitle: "删除路径？",
  deleteDialogDescription: "此操作不可逆。路径中的讲座不会被删除——只删除路径本身。",
  deleteDialogConfirm: "删除",
  deleteAction: "删除路径",
  deleteForbiddenTitle: "无法删除",
  deleteFailureTitle: "无法删除",

  // --- trail-items-editor ---
  itemsHeading: "路径内容",
  itemsEmpty: "路径为空。请添加文档。",
  itemsMoveUp: "上移",
  itemsMoveDown: "下移",
  itemsRemove: "移除",
  itemsPickerCancel: "取消",
  itemsAddDocument: "+ 添加文档",
  itemsSaveSubmit: "保存内容",
  itemsSavedTitle: "已保存",
  itemsSavedDescription: "路径内容已更新。",
  itemsErrorTitle: "错误",
  itemsAlreadyAddedTitle: "已添加",
  itemsAlreadyAddedDescription: "此文档已在路径中。",
  itemsForbiddenAction: "修改路径",
  itemsValidationError: "请检查文档列表。",

  // --- trail-visibility-button ---
  visibilityMakePublic: "设为公开",
  visibilityForbiddenAction: "更改可见性",

  // --- trail-detail ---
  detailDocumentsHeading: "路径文档",
  detailDocumentsEmpty: "此路径暂无文档。",

  // --- trail-my-list ---
  myListEmpty: "您还没有任何路径。",
  myListUntitled: "无标题",
  visibilityPrivate: "私有",
  visibilityPublic: "公开",

  // --- trail-public-list ---
  publicListEmpty: "暂无路径。",
  publicListUntitled: "无标题",

  // --- trail-admin-row ---
  adminUntitled: "无标题",
  adminAuthorLabel: "作者",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "加载路径列表失败",
    loadItemFailed: "加载路径失败",
  },
};

export default trails;
