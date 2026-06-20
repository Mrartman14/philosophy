// src/i18n/messages/en/tokens.ts
const tokens = {
  // --- Create form (tokens-manager.tsx) ---
  labelField: "Label",
  labelPlaceholder: "e.g. Claude Desktop",
  expiresField: "Expiry",
  expiresNever: "Never",
  expires7: "7 days",
  expires30: "30 days",
  expires90: "90 days",
  createButton: "Create token",
  createHint:
    "A token grants API access on your behalf — e.g. to connect an external service with its own LLM.",
  limitsHint:
    "Label is required. Maximum lifetime is 90 days (or never expires). The secret is shown only once.",
  createAction: "create token",

  // --- One-time secret reveal ---
  revealTitle: "Token created",
  revealWarning: "Copy it now — it won't be shown again.",
  revealAriaLabel: "Raw token",
  revealDismiss: "Done",
  createdNoSecretTitle: "Token created",
  createdNoSecretDesc: "No secret returned — refresh the list and check the token.",

  // --- Connect (connect-instructions.tsx) ---
  connectTitle: "How to connect",
  connectIntro:
    "Create a token above, then add philosophy as an MCP connector in your LLM client (Claude, Cursor, ChatGPT) and paste the token.",
  connectUrlLabel: "MCP server URL",
  connectCliLabel: "Claude Code (terminal)",
  connectDesktopHint:
    "Claude Desktop / claude.ai: Settings → Connectors → add a custom connector with this URL, token goes into the auth (Bearer).",

  // --- List (token-list.tsx) ---
  colStatus: "Status",
  colLabel: "Label",
  colHint: "Hint",
  colCreated: "Created",
  colExpires: "Expires",
  colAction: "Action",
  statusActive: "Active",
  statusRevoked: "Revoked",
  statusExpired: "Expired",
  neverExpires: "Never",
  revokeButton: "Revoke",
  revokeAction: "revoke token",
  revokedToast: "Token revoked",
  confirmRevokeTitle: "Revoke token?",
  confirmRevokeDesc:
    "Any client using this token loses access immediately. This cannot be undone.",
  emptyTitle: "No tokens yet",
  emptyDesc: "Create a token to connect an external service.",

  // --- Copy (copy-button.tsx) ---
  copyLabel: "Copy",
  copiedLabel: "Copied",
  copiedToast: "Copied",
  copyFailTitle: "Copy failed",
  copyFailDesc: "Copy it manually.",

  // --- Usage tracking (usage-tracking-toggle.tsx) ---
  usageTrackingHeading: "Usage tracking",
  usageTrackingIntro:
    "When enabled, each token records its request count and last-used time.",
  usageTrackingEnabledStatus: "Tracking is enabled.",
  usageTrackingDisabledStatus: "Tracking is disabled.",
  usageTrackingEnableButton: "Enable tracking",
  usageTrackingDisableButton: "Disable tracking",
  usageTrackingDisableDialogTitle: "Disable usage tracking?",
  usageTrackingDisableDialogDescription:
    "All accumulated counters (request count and last-used time) will be deleted permanently.",
  usageTrackingDisableConfirmLabel: "Disable and delete",
  usageTrackingSavedTitle: "Saved",
  usageTrackingEnabledToast: "Usage tracking enabled.",
  usageTrackingDisabledToast: "Tracking disabled, counters deleted.",
  usageTrackingManageAction: "change tracking settings",
  // token table columns
  colLastUsed: "Last used",
  colRequests: "Requests",

  // --- API errors (api.ts) ---
  api: {
    loadFailed: "Failed to load tokens",
  },
};

export default tokens;
