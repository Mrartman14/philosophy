// src/i18n/messages/zh/banners.ts
// Mirror of ru/banners.ts. Key parity enforced by satisfies Messages.
const banners = {
  // --- Form field labels (create + edit) ---
  fieldVariant: "横幅类型",
  variantInfo: "信息",
  variantSuccess: "成功",
  variantWarning: "警告",
  variantDanger: "严重",
  variantBrand: "品牌",
  variantNeutral: "中性",
  fieldAudience: "受众",
  fieldAudienceAriaLabel: "受众",
  fieldDismissible: "允许用户关闭横幅",
  fieldStartAt: "开始展示（你的时区）",
  fieldEndAt: "结束展示（你的时区，可选）",
  fieldEventId: "活动 ID（可选）",
  fieldBlocks: "横幅文本",
  eventIdPlaceholder: "活动 ID（见「管理后台 → 活动」）",

  // --- Hints ---
  hintEndAt:
    "已保存的「结束展示」时间无法清除——请保留原有值或填写新值。",
  hintEventId: "若要解除关联活动——请清空该字段并保存。",

  // --- Buttons / submit ---
  createButton: "创建",
  saveButton: "保存",
  deleteButton: "删除",
  editButton: "编辑",

  // --- Status ---
  saved: "已保存。",

  // --- Forbidden inline (Case 3: banner-edit-form only) ---
  editAction: "修改横幅",

  // --- Delete confirmation ---
  deleteTitle: "删除横幅？",
  deleteDescription: "此操作不可撤销。横幅将从所有页面消失。",

  // --- Toast actions (for toastActionError) ---
  deleteAction: "删除横幅",
  dismissAction: "关闭横幅",
  dismissFailTitle: "无法关闭横幅",

  // --- Dismiss button ---
  dismissAriaLabel: "关闭横幅",

  // --- admin-row ---
  noText: "无文本横幅",
  notDismissible: " · 无法关闭",
  hasEvent: " · 已关联活动",

  // --- active-banners aria ---
  sectionLabel: "公告",

  // --- Audience labels ---
  audienceAll: "所有人",
  audienceAuthenticated: "已登录用户",
  audienceAdmin: "管理员",

  // --- Display period (formatBannerPeriod) ---
  periodFrom: "自 {start}",
  periodFromTo: "自 {start} 至 {end}",

  // --- create-form: forbiddenAction (Case 3) ---
  createAction: "创建横幅",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "无法加载横幅列表",
    loadItemFailed: "无法加载横幅",
    loadRevisionsFailed: "无法加载修订",
    loadRevisionFailed: "无法加载修订",
  },
};

export default banners;
