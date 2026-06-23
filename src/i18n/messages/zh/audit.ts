// src/i18n/messages/zh/audit.ts
// English translations for the audit (admin log) slice.
const audit = {
  // --- audit-filter-form: field labels and buttons ---
  filterAllTypes: "所有类型",
  filterActorLabel: "操作者 ID（UUID）",
  filterTargetTypeLabel: "目标类型",
  filterTargetIdLabel: "目标 ID",
  filterTargetIdPlaceholder: "实体 ID",
  filterActionLabel: "操作",
  filterAllActions: "所有操作",
  filterFromLabel: "起始",
  filterToLabel: "截止",
  filterSubmit: "筛选",
  filterReset: "重置",

  // --- admin audit page ---
  pageTitle: "审计",
  pageDescription: "管理员操作日志。记录总数：{total}",

  // --- audit-table: column headers and empty state ---
  colTime: "时间",
  colActor: "操作者",
  colAction: "操作",
  colTarget: "目标",
  colDetails: "详情",
  detailsToggle: "显示",
  emptyTitle: "未找到记录",
  emptyDescription: "请尝试放宽筛选条件或扩大时间范围。",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadLogFailed: "加载审计日志失败",
  },
};

export default audit;
