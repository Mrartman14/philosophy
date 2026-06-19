// src/i18n/messages/en/common.ts
// Common UI strings: navigation, statuses, component templates.
const common = {
  // Navigation (app-header, app-nav)
  nav: {
    lectures: "Lectures",
    calendar: "Calendar",
    trails: "Trails",
    canvases: "Canvases",
    login: "Log in",
  },

  // install-banner
  installBanner: {
    installApp: "Install the app on your device",
    install: "Install",
    iosHint: "Tap Share ⎋ → Add to Home Screen to install",
  },

  // network-indicator
  networkIndicator: {
    offline: "No network",
  },

  // update-prompt
  updatePrompt: {
    updateAvailable: "Update available",
    update: "Update",
  },

  // shared/go-back
  back: "Back",

  // permission/action-tooltip
  actionTooltip: {
    loginToAction: "Log in to {action}",
    accountRestrictedAction: "Account restricted — cannot {action}",
    actionUnavailable: "Action unavailable",
  },

  // permission/status-banner
  statusBanner: {
    suspended: "Your account is temporarily restricted. Reading is available, new actions are not.",
  },

  // permission/login-cta
  loginCta: {
    loginToContinue: "Log in to continue",
    loginButton: "Log in",
  },

  // canvas-render
  canvasRender: {
    emptyGraph: "Graph is empty.",
    graphAriaLabel: "Canvas graph",
  },

  // revision-history
  revisionHistory: {
    title: "Revision history",
    empty: "No revisions yet.",
  },

  // attachments
  attachments: {
    title: "Attachments",
    empty: "Nothing attached yet.",
    operationError: "Operation failed",
    attach: "Attach",
    canvasNoPreview: "(canvas — preview unavailable)",
    moveUp: "Move up",
    moveDown: "Move down",
    detach: "Detach",
    search: "Search…",
  },
};

export default common;
