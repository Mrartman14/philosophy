// src/i18n/messages/zh/shareLinks.ts
// Mirror of ru/shareLinks.ts (Simplified Chinese literals). Key parity is enforced by satisfies Messages.
const shareLinks = {
  // --- resource types ---
  resourceTypes: {
    lecture: "讲座",
    document: "文档",
    trail: "路径",
    media: "媒体",
    form: "表单",
    canvas: "画布",
  },

  // --- copy-button ---
  copyDefault: "复制",
  copiedLabel: "已复制 ✓",
  copiedToast: "已复制",
  copyFailTitle: "复制失败",
  copyFailDesc: "请选中链接并手动复制。",

  // --- share-button ---
  shareButtonLabel: "分享",
  shareDialogTitle: "分享：{type}",
  shareDialogDesc: "持有该链接的人无需登录即可打开此私有资源。",
  expiresAtLabel: "有效期（可选）",
  createLinkButton: "创建链接",
  linkCreatedToast: "链接已创建",

  // --- share-link-list ---
  statusActive: "有效",
  statusExpired: "已过期",
  statusRevoked: "已撤销",
  emptyTitle: "暂无链接",
  emptyDesc: "尚未为此资源发布任何分享链接。",
  colStatus: "状态",
  colLink: "链接",
  colToken: "令牌",
  colCreated: "创建时间",
  colExpires: "过期时间",
  colAction: "操作",
  urlAriaLabel: "分享链接 URL",
  revokeButton: "撤销",
  revokedToast: "链接已撤销",

  // --- share-lookup-form ---
  resourceTypeLabel: "资源类型",
  resourceIdLabel: "资源 ID",
  resourceIdPlaceholder: "资源 UUID",
  showLinksButton: "显示链接",

  // --- toastActionError actions (phrase for errors.forbiddenAction) ---
  createLinkAction: "创建链接",
  revokeLinkAction: "撤销链接",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadLinksFailed: "无法加载分享链接",
  },
};

export default shareLinks;
