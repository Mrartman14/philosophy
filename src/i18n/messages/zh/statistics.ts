// src/i18n/messages/zh/statistics.ts
// Mirror of ru/statistics.ts (Simplified Chinese literals).
const statistics = {
  // --- entity type labels (view-stats, production-stats-table) ---
  entityType: {
    lecture: "讲座",
    document: "文档",
    trail: "路径",
    canvas: "画布",
    form: "表单",
    media: "媒体",
    annotation: "批注",
    comment: "评论",
  },

  // --- view-stats ---
  trackingDisabledTitle: "浏览跟踪已关闭",
  trackingDisabledDescription: "在设置中开启它，即可查看您的浏览统计。",
  goToSettings: "前往设置",
  noViewsTitle: "您还没有浏览任何内容",
  noViewsDescription: "首次浏览后将显示统计数据。",
  totalViews: "总浏览量：",
  untitled: "无标题",
  unavailable: "不可用",
  viewCount: "{count} 次浏览",

  // --- production-stats-table ---
  noProductionTitle: "您还没有创建任何内容",
  noProductionDescription: "这里将显示您的讲座、文档及其他材料的统计数据。",
  colType: "类型",
  colTotal: "总计",
  colPublic: "公开",
  colPrivate: "私有",
  totalsRow: "合计",

  // --- history-tracking-toggle ---
  savedTitle: "已保存",
  trackingEnabledDescription: "浏览跟踪已开启。",
  trackingDisabledAfterPurge: "跟踪已关闭，历史已删除。",
  trackingEnabledStatus: "浏览跟踪已开启。",
  trackingDisabledStatus: "浏览跟踪已关闭。",
  disableButton: "关闭",
  enableButton: "开启",
  disableDialogTitle: "关闭跟踪？",
  disableDialogDescription: "所有浏览历史将被永久删除。",
  disableConfirmLabel: "删除历史",
  // Action phrase for "You don't have permission for {action}."
  manageSettingsAction: "更改设置",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadStatsFailed: "无法加载统计数据",
    loadViewStatsFailed: "无法加载浏览统计数据",
    loadHistorySettingsFailed: "无法加载历史设置",
  },
};

export default statistics;
