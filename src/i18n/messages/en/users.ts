// src/i18n/messages/en/users.ts
// Mirror of ru/users.ts. Key parity enforced by satisfies Messages.
const users = {
  // --- roles ---
  roleUser: "User",
  roleAdmin: "Administrator",

  // --- statuses ---
  statusActive: "Active",
  statusSuspended: "Suspended",
  statusBanned: "Banned",

  // --- table ---
  emptyState: "No users found",
  colName: "Name",
  colRole: "Role",
  colStatus: "Status",
  colCreated: "Created",
  colId: "ID",
  selfBadge: "(you)",
  dateFallback: "—",

  // --- user-role-control ---
  roleAriaLabel: "Role of user {username}",
  roleUpdated: "Role updated",
  changeRoleAction: "changing user role",
  changeRoleFailed: "Failed to change role",

  // --- user-status-control ---
  statusAriaLabel: "Status of user {username}",
  statusUpdated: "Status updated",
  changeStatusAction: "changing user status",
  changeStatusFailed: "Failed to change status",
  confirmBanTitle: "Ban {username}?",
  confirmBanDescription:
    "A banned user will not be able to log in. The status can be reversed later.",
  confirmBanLabel: "Ban",

  // --- shared across controls ---
  applyButton: "Apply",

  // --- CONFLICT sub-mapping ---
  conflictOwnStatus: "You cannot change your own status.",
  conflictOwnRole: "You cannot change your own role.",
  conflictLastAdmin:
    "You cannot suspend or ban the last active administrator.",
  conflictDemoteLastAdmin:
    "You cannot demote the last active administrator.",
  conflictFallback: "Operation rejected by the server (conflict).",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Failed to load users",
  },
};

export default users;
