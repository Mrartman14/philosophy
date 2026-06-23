// src/i18n/messages/zh/events.ts
// Mirror of ru/events.ts (Simplified Chinese literals). Key parity enforced by satisfies Messages.
const events = {
  // --- calendar navigation ---
  prevMonth: "上一个",
  nextMonth: "下一个",
  monthNavLabel: "月份导航",
  noEvents: "本月没有活动。",
  recurringEvent: "重复活动",

  // --- event-admin-row ---
  allDayBadge: " · 全天",
  recurringBadge: " · 重复",
  editLink: "编辑",

  // --- event-edit-form / event-create-form labels ---
  fieldTitle: "标题",
  fieldAllDay: "全天",
  fieldStartDate: "开始日期",
  fieldStartDateTime: "开始日期和时间（您的时区）",
  fieldEndDate: "结束日期（可选）",
  fieldEndDateTime: "结束日期和时间（您的时区，可选）",
  fieldRrule: "重复（RRULE，可选）",
  fieldBlocks: "活动描述",
  titlePlaceholder: "例如：「康德研讨会」",
  clearLimitation:
    "已保存的「结束日期」和「重复」无法清除——后端会忽略这些字段的空值。",

  // --- event-edit-form status ---
  savedSuccess: "已保存。",
  // Case 3: per-feature action phrase for forbiddenAction.
  editAction: "修改活动",

  // --- submit buttons ---
  saveButton: "保存",
  createButton: "创建",

  // Case 3: per-feature action phrase for create form forbiddenAction
  createAction: "创建活动",

  // --- event-delete-button ---
  deleteButton: "删除",
  deleteDialogTitle: "删除活动？",
  deleteDialogDescription:
    "此操作不可逆。活动将从公共日历中消失。",
  deleteConfirmLabel: "删除",
  deleteAction: "删除活动",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "无法加载活动列表",
    loadItemFailed: "无法加载活动",
    loadRevisionsFailed: "无法加载修订",
    loadRevisionFailed: "无法加载修订",
    loadCalendarFailed: "无法加载日历",
  },
};

export default events;
