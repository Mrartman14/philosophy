// src/i18n/messages/zh/common.ts
// Common UI strings: navigation, statuses, component templates.
const common = {
  // Navigation (app-header, app-nav)
  nav: {
    lectures: "讲座",
    calendar: "日历",
    trails: "路径",
    canvases: "画布",
    login: "登录",
  },

  // install-banner
  installBanner: {
    installApp: "将应用安装到设备",
    install: "安装",
    iosHint: "点击「分享」⎋ →「添加到主屏幕」即可安装",
  },

  // network-indicator
  networkIndicator: {
    offline: "无网络连接",
  },

  // update-prompt
  updatePrompt: {
    updateAvailable: "有可用更新",
    update: "更新",
  },

  // shared/go-back
  back: "返回",

  // UI-kit: pagination (rendered in server components — resolved via getT on the
  // caller side and passed through the labels prop)
  pagination: {
    ariaLabel: "分页",
    prev: "上一页",
    next: "下一页",
    range: "{total} 项中的 {from}–{to}",
    rangeEmpty: "共 0 项",
  },

  // UI-kit: confirm-dialog (client)
  confirmDialog: {
    confirm: "确认",
    cancel: "取消",
  },

  // UI-kit: select (client)
  select: {
    placeholder: "请选择…",
  },

  // UI-kit: form-field (client) — localizes the native browser `required`
  // (valueMissing) validation message. Without it Base UI surfaces
  // `element.validationMessage`, localized to the BROWSER language, not the UI locale.
  field: {
    required: "请填写此字段",
    invalid: "请输入有效的值",
  },

  // permission/status-banner
  statusBanner: {
    suspended: "您的账户已被临时限制。可以阅读，但无法进行新的操作。",
  },

  // canvas-render
  canvasRender: {
    emptyGraph: "图谱为空。",
    graphAriaLabel: "画布图谱",
  },

  // revision-history
  revisionHistory: {
    title: "修订历史",
    empty: "暂无修订。",
  },

  // attachments
  attachments: {
    title: "附件",
    empty: "暂无附件。",
    operationError: "操作失败",
    attach: "附加",
    canvasNoPreview: "（画布 — 无法预览）",
    moveUp: "上移",
    moveDown: "下移",
    detach: "移除",
    search: "搜索…",
  },
};

export default common;
