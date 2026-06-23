// src/i18n/messages/zh/forms.ts
// Mirror of ru/forms.ts. Key parity enforced by satisfies Messages.
const forms = {
  // --- field-kinds: field type labels ---
  fieldType: {
    text: "短文本",
    long_text: "长文本",
    single_choice: "单选",
    multi_choice: "多选",
    number: "数字",
    date: "日期",
  },

  // --- form-meta: status labels ---
  visibility: {
    private: "私有",
    public: "公开",
    // *Lower — lowercase variant for mid-sentence interpolation
    // (my-forms-list: "Visibility: {privateLower}"). Intentional convention.
    privateLower: "私有",
    publicLower: "公开",
  },
  submissionMode: {
    editable: "可修改或删除回复",
    immutable: "仅可撤回回复",
    // *Lower — lowercase variant for mid-sentence interpolation
    // (my-forms-list: "Mode: {editableLower}"). Intentional convention.
    editableLower: "可编辑",
    immutableLower: "不可修改",
  },
  publishedBadge: "已发布",
  publishedSuffix: " · 已发布",
  draftSuffix: " · 草稿",

  // --- form-detail: fallback title ---
  untitled: "表单",
  untitledForm: "无标题",

  // --- form-after-submit ---
  afterSubmitTitle: "提交后",

  // --- form-builder ---
  builder: {
    titleLabel: "表单标题",
    descriptionLabel: "描述（markdown，可选）",
    afterSubmitLabel: "提交后显示的文本（markdown，可选）",
    visibilityLabel: "可见性",
    visibilityPrivate: "私有",
    visibilityPublic: "公开（立即发布）",
    submissionModeLabel: "回复模式",
    submissionModeEditable: "可编辑（回复可修改或删除）",
    submissionModeImmutable: "不可修改（回复仅可撤回）",
    submissionModeHint:
      "“不可修改”模式之后无法放宽。公开表单无法重新设为私有，其结构也无法更改。",
    addField: "+ 添加字段",
  },

  // --- form-builder-field-row ---
  fieldRow: {
    heading: "字段 #{index}",
    ariaUp: "上移",
    ariaDown: "下移",
    ariaRemove: "删除",
    typeLabel: "字段类型",
    promptLabel: "问题文本（markdown）",
    helpLabel: "提示（可选，markdown）",
    requiredLabel: "必填字段",
    optionsLabel: "选项",
    optionPlaceholder: "选项 {index}",
    ariaRemoveOption: "删除选项",
    addOption: "+ 选项",
  },

  // --- form-create-form / form-edit-form: buttons ---
  createSubmit: "创建表单",
  editSubmit: "保存结构",

  // --- form-delete-button / form-admin-row ---
  deleteFormLabel: "删除表单",
  deleteFormTitle: "删除表单？",
  deleteFormDescriptionAdmin: "将删除该公开表单及其所有回复。此操作不可逆。",
  deleteFormDescription: "此操作不可逆。该表单的所有回复都将被删除。",
  deleteConfirm: "删除",

  // --- form-publish-button ---
  publishButton: "发布",
  publishTitle: "发布表单？",
  publishDescription:
    "发布后，表单无法重新设为私有，其结构也无法更改。现有的分享链接将停止工作。",
  publishConfirm: "发布",

  // --- form-fill ---
  submitSuccessMessage: "回复已提交。谢谢！",
  requiredFieldsTitle: "请填写必填字段",
  requiredFieldsDescription: "并非所有必填字段都已填写。",
  submitButton: "提交回复",
  submittingButton: "提交中…",

  // --- submission-actions ---
  deleteSubmissionButton: "删除回复",
  retractSubmissionButton: "撤回回复",
  deleteSubmissionTitle: "删除回复？",
  retractSubmissionTitle: "撤回回复？",
  deleteSubmissionDescription: "该回复将被删除。您可以重新填写此表单。",
  retractSubmissionDescription: "撤回不可逆：您将无法再次提交对此表单的回复。",
  deleteSubmissionConfirm: "删除",
  retractSubmissionConfirm: "撤回",

  // --- submission-detail ---
  submissionRetracted: "回复已撤回 — 答案已删除。",

  // --- submission-edit-form ---
  saveButton: "保存更改",
  savingButton: "保存中…",

  // --- my-forms-list ---
  noForms: "您还没有任何表单。",

  // --- my-submissions-list ---
  noSubmissions: "您还没有任何回复。",
  submissionRetractedLabel: "已撤回",
  formLinkPrefix: "表单 {id}",

  // --- submission-list ---
  noSubmissionsAdmin: "暂无回复。",
  submissionLinkPrefix: "回复 {id}",

  // --- toastActionError actions (phrase for errors.forbiddenAction) ---
  fillAction: "提交回复",
  submissionEditAction: "修改回复",
  publishAction: "发布表单",
  deleteFormAction: "删除表单",
  deleteSubmissionAction: "删除回复",
  retractSubmissionAction: "撤回回复",

  // --- toastActionError failureTitle overrides ---
  fillFailureTitle: "提交失败",
  submissionEditFailureTitle: "保存失败",

  // --- forbiddenAction per-feature phrases (for FormFeedback.forbiddenAction) ---
  editFormForbiddenAction: "修改表单",
  createFormForbiddenAction: "创建表单",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadItemFailed: "加载表单失败",
    loadMyFailed: "加载表单失败",
    loadMySubmissionsFailed: "加载回复失败",
    loadSubmissionsFailed: "加载回复失败",
    loadSubmissionFailed: "加载回复失败",
    loadAdminFailed: "加载表单失败",
  },
};

export default forms;
