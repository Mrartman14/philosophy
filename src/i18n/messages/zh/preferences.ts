// src/i18n/messages/zh/preferences.ts
// Mirror of ru/preferences.ts.
const preferences = {
  // --- preferences-form ---
  readingModeLabel: "阅读模式",
  readingModeDescription:
    "「专注」模式会隐藏讲座页面上的次要元素。",
  readingModeAriaLabel: "阅读模式",
  readingModeFull: "完整",
  readingModeFocused: "专注",
  settingsSaved: "设置已保存。",
  saveButton: "保存",
  // Action phrase for "You don't have permission for {action}."
  updateSettingsAction: "修改设置",

  // --- push-send-form ---
  pushTitleLabel: "标题",
  pushBodyLabel: "正文",
  pushUrlLabel: "链接",
  pushUrlDescription:
    "点击通知时打开。可以是路径（「/lectures/…」）或完整的 http(s) 网址。",
  pushTitlePlaceholder: "例如：「新讲座」",
  pushSendAccepted: "群发已受理，将在后台投递给订阅者。",
  pushSendButton: "发送",
  // Action phrase for "You don't have permission for {action}."
  pushSendAction: "发送推送通知",

  // --- push-subscription-toggle ---
  pushCheckingSubscription: "正在检查订阅…",
  pushUnsupported: "此浏览器不支持推送通知。",
  pushDenied: "通知已被屏蔽。请在浏览器设置中允许通知。",
  pushUnavailable: "推送通知暂时不可用。",
  pushSubscribed: "您已订阅通知。",
  pushNotSubscribed: "您尚未订阅通知。",
  pushUnsubscribeButton: "取消订阅",
  pushSubscribeButton: "订阅",
  pushNoPermission: "您没有订阅通知的权限。",
  pushSubscribeError: "订阅失败。请重试。",
  pushUnsubscribeError: "取消订阅失败。请重试。",
  // Action phrase for "You don't have permission for {action}."
  pushSubscribeAction: "订阅通知",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadFailed: "无法加载偏好设置",
  },
};

export default preferences;
