// src/i18n/messages/ru/users.ts
// Namespace для слайса users (управление пользователями в админке).
const users = {
  // --- роли ---
  roleUser: "Пользователь",
  roleAdmin: "Администратор",

  // --- статусы ---
  statusActive: "Активен",
  statusSuspended: "Приостановлен",
  statusBanned: "Заблокирован",

  // --- таблица ---
  emptyState: "Пользователи не найдены",
  colName: "Имя",
  colRole: "Роль",
  colStatus: "Статус",
  colCreated: "Создан",
  colId: "ID",
  selfBadge: "(вы)",
  dateFallback: "—",

  // --- user-role-control ---
  roleAriaLabel: "Роль пользователя {username}",
  roleUpdated: "Роль обновлена",
  changeRoleAction: "изменение роли пользователя",
  changeRoleFailed: "Не удалось изменить роль",

  // --- user-status-control ---
  statusAriaLabel: "Статус пользователя {username}",
  statusUpdated: "Статус обновлён",
  changeStatusAction: "изменение статуса пользователя",
  changeStatusFailed: "Не удалось изменить статус",
  confirmBanTitle: "Заблокировать {username}?",
  confirmBanDescription:
    "Заблокированный пользователь не сможет войти в систему. Статус можно будет вернуть позже.",
  confirmBanLabel: "Заблокировать",

  // --- общий для controls ---
  applyButton: "Применить",

  // --- CONFLICT под-маппинг (err.error → ключ) ---
  conflictOwnStatus: "Нельзя изменить собственный статус.",
  conflictOwnRole: "Нельзя изменить собственную роль.",
  conflictLastAdmin:
    "Нельзя приостановить или заблокировать последнего активного администратора.",
  conflictDemoteLastAdmin:
    "Нельзя понизить роль последнего активного администратора.",
  conflictFallback: "Операция отклонена сервером (конфликт).",
};

export default users;
