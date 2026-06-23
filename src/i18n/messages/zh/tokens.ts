// src/i18n/messages/zh/tokens.ts
const tokens = {
  // --- Create form (tokens-manager.tsx) ---
  labelField: "名称",
  labelPlaceholder: "例如 Claude Desktop",
  expiresField: "有效期",
  expiresNever: "永久有效",
  expires7: "7 天",
  expires30: "30 天",
  expires90: "90 天",
  createButton: "创建令牌",
  createHint:
    "令牌允许以您的身份访问 API——例如用于连接带有自有 LLM 的外部服务。",
  limitsHint:
    "名称为必填项。最长有效期为 90 天（或永久有效）。密钥仅显示一次。",
  createAction: "创建令牌",

  // --- One-time secret reveal ---
  revealTitle: "令牌已创建",
  revealWarning: "请立即复制——它不会再次显示。",
  revealAriaLabel: "原始令牌",
  revealDismiss: "完成",
  createdNoSecretTitle: "令牌已创建",
  createdNoSecretDesc: "未返回密钥——请刷新列表并检查该令牌。",

  // --- Connect (connect-instructions.tsx) ---
  connectTitle: "如何连接",
  connectIntro:
    "在上方创建令牌，然后在您的 LLM 客户端（Claude、Cursor、ChatGPT）中将 philosophy 添加为 MCP 连接器并粘贴令牌。",
  connectUrlLabel: "MCP 服务器 URL",
  connectCliLabel: "Claude Code（终端）",
  connectDesktopHint:
    "Claude Desktop / claude.ai：设置 → Connectors → 使用此 URL 添加自定义连接器，令牌填入授权（Bearer）。",

  // --- List (token-list.tsx) ---
  colStatus: "状态",
  colLabel: "名称",
  colHint: "提示",
  colCreated: "创建时间",
  colExpires: "到期时间",
  colAction: "操作",
  statusActive: "有效",
  statusRevoked: "已吊销",
  statusExpired: "已过期",
  neverExpires: "永久有效",
  revokeButton: "吊销",
  revokeAction: "吊销令牌",
  revokedToast: "令牌已吊销",
  confirmRevokeTitle: "吊销令牌？",
  confirmRevokeDesc:
    "使用此令牌的所有客户端将立即失去访问权限。此操作无法撤销。",
  emptyTitle: "暂无令牌",
  emptyDesc: "创建令牌以连接外部服务。",

  // --- Copy (copy-button.tsx) ---
  copyLabel: "复制",
  copiedLabel: "已复制",
  copiedToast: "已复制",
  copyFailTitle: "复制失败",
  copyFailDesc: "请手动复制。",

  // --- Usage tracking (usage-tracking-toggle.tsx) ---
  usageTrackingHeading: "使用情况跟踪",
  usageTrackingIntro:
    "启用后，每个令牌会记录其请求次数和最近使用时间。",
  usageTrackingEnabledStatus: "跟踪已启用。",
  usageTrackingDisabledStatus: "跟踪已停用。",
  usageTrackingEnableButton: "启用跟踪",
  usageTrackingDisableButton: "停用跟踪",
  usageTrackingDisableDialogTitle: "停用使用情况跟踪？",
  usageTrackingDisableDialogDescription:
    "所有累计的计数器（请求次数和最近使用时间）将被永久删除。",
  usageTrackingDisableConfirmLabel: "停用并删除",
  usageTrackingSavedTitle: "已保存",
  usageTrackingEnabledToast: "使用情况跟踪已启用。",
  usageTrackingDisabledToast: "跟踪已停用，计数器已删除。",
  usageTrackingManageAction: "更改跟踪设置",
  // token table columns
  colLastUsed: "最近使用",
  colRequests: "请求次数",

  // --- API errors (api.ts) ---
  api: {
    loadFailed: "加载令牌失败",
  },
};

export default tokens;
