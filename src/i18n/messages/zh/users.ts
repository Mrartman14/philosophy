// src/i18n/messages/zh/users.ts
// Mirror of ru/users.ts. Key parity enforced by satisfies Messages.
const users = {
  // --- roles ---
  roleUser: "用户",
  roleAdmin: "管理员",

  // --- statuses ---
  statusActive: "已激活",
  statusSuspended: "已暂停",
  statusBanned: "已封禁",

  // --- table ---
  emptyState: "未找到用户",
  colName: "姓名",
  colRole: "角色",
  colStatus: "状态",
  colCreated: "创建于",
  colId: "ID",
  selfBadge: "（你）",
  dateFallback: "—",

  // --- user-role-control ---
  roleAriaLabel: "用户 {username} 的角色",
  roleUpdated: "角色已更新",
  changeRoleAction: "更改用户角色",
  changeRoleFailed: "无法更改角色",

  // --- user-status-control ---
  statusAriaLabel: "用户 {username} 的状态",
  statusUpdated: "状态已更新",
  changeStatusAction: "更改用户状态",
  changeStatusFailed: "无法更改状态",
  confirmBanTitle: "封禁 {username}？",
  confirmBanDescription:
    "被封禁的用户将无法登录。该状态稍后可以恢复。",
  confirmBanLabel: "封禁",

  // --- shared across controls ---
  applyButton: "应用",

  // --- CONFLICT sub-mapping ---
  conflictOwnStatus: "无法更改自己的状态。",
  conflictOwnRole: "无法更改自己的角色。",
  conflictLastAdmin:
    "无法暂停或封禁最后一位活跃的管理员。",
  conflictDemoteLastAdmin:
    "无法降低最后一位活跃管理员的角色。",
  conflictFallback: "无法保存：数据已发生变化。请刷新页面后重试。",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "无法加载用户",
  },
};

export default users;
