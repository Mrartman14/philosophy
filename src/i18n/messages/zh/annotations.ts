// src/i18n/messages/zh/annotations.ts
// Mirror of ru/annotations.ts. Key parity enforced by satisfies Messages in en/index.ts.
const annotations = {
  // --- annotation-card ---
  visibility: {
    private: "私有",
    public: "公开",
    unknown: "私有",
  },
  edited: " · 已编辑",

  // --- annotation-list ---
  empty: "暂无批注。",

  // --- annotation-create-form ---
  createBodyLabel: "批注内容",
  createBodyAriaLabel: "批注内容",
  createSubmit: "添加批注",
  createForbiddenAction: "创建批注",

  // --- annotation-edit-form ---
  editBodyLabel: "批注内容",
  editBodyAriaLabel: "批注内容",
  editSuccess: "已保存。",
  editForbiddenAction: "编辑批注",
  editSubmit: "保存",

  // --- annotation-edit-button ---
  editButton: "编辑",
  editDialogTitle: "编辑批注",
  editorLoading: "正在加载编辑器…",

  // --- annotation-delete-button ---
  deleteButton: "删除",
  deleteDialogTitle: "删除批注？",
  deleteDialogDescription: "此操作不可撤销。",
  deleteDialogConfirm: "删除",
  deleteAction: "删除批注",

  // --- annotation-visibility-field ---
  visibilityLegend: "可见性",
  visibilityPrivateLabel: "私有（仅自己可见）",
  visibilityPublicLabel: "公开（所有能看到该实体的人均可见）",
  visibilityImmutableNote: "创建后无法更改可见性。",

  // --- annotation-admin-filter-form ---
  filterEntityTypeLabel: "实体类型：",
  filterEntityTypeAll: "全部",

  // --- annotations-section ---
  sectionLabel: "批注",
  sectionHeading: "批注",

  // --- annotation-admin-row ---
  adminAuthorLabel: "作者",

  // --- actions.ts: internal error when annotation not found ---
  notFound: "未找到批注。",

  // --- marginalia engine (composer / connector) ---
  marginAddButton: "批注",
  marginAddUnanchored: "添加批注",
  marginComposerTitle: "新批注",
  marginOrphanLabel: "未找到片段",
  marginHighlightToggleOn: "隐藏高亮",
  marginHighlightToggleOff: "显示高亮",
  marginColumnLabel: "页边批注",
  marginExpand: "显示全文",
  marginCollapse: "收起",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "无法加载批注",
    loadListFailedStatus: "无法加载批注（{status}）",
    loadItemFailed: "无法加载批注",
    loadMyFailed: "无法加载我的批注",
    loadLectureFailed: "无法加载讲座批注",
    loadAdminFailed: "无法加载批注列表",
    loadRevisionsFailed: "无法加载修订",
    loadRevisionFailed: "无法加载修订",
  },
};

export default annotations;
