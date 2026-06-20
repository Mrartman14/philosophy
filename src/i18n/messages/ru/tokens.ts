// src/i18n/messages/ru/tokens.ts
const tokens = {
  // --- Форма создания (tokens-manager.tsx) ---
  labelField: "Название",
  labelPlaceholder: "Например, Claude Desktop",
  expiresField: "Срок",
  expiresNever: "Бессрочно",
  expires7: "7 дней",
  expires30: "30 дней",
  expires90: "90 дней",
  createButton: "Создать токен",
  createHint:
    "Токен даёт доступ к API от вашего имени — например, для подключения внешнего сервиса со своим LLM.",
  limitsHint:
    "Название обязательно. Максимальный срок — 90 дней (или бессрочно). Секрет показывается один раз.",
  createAction: "создать токен",

  // --- Одноразовый показ секрета (reveal) ---
  revealTitle: "Токен создан",
  revealWarning: "Скопируйте его сейчас — больше он показан не будет.",
  revealAriaLabel: "Сырой токен",
  revealDismiss: "Готово",
  createdNoSecretTitle: "Токен создан",
  createdNoSecretDesc: "Секрет не получен — обновите список и проверьте токен.",

  // --- Подключение (connect-instructions.tsx) ---
  connectTitle: "Как подключить",
  connectIntro:
    "Создайте токен выше, затем добавьте philosophy как MCP-коннектор в вашем LLM-клиенте (Claude, Cursor, ChatGPT) и подставьте токен.",
  connectUrlLabel: "URL MCP-сервера",
  connectCliLabel: "Claude Code (терминал)",
  connectDesktopHint:
    "Claude Desktop / claude.ai: Настройки → Connectors → добавить custom connector по этому URL, токен — в авторизации (Bearer).",

  // --- Список (token-list.tsx) ---
  colStatus: "Статус",
  colLabel: "Название",
  colHint: "Подсказка",
  colCreated: "Создан",
  colExpires: "Истекает",
  colAction: "Действие",
  statusActive: "Активен",
  statusRevoked: "Отозван",
  statusExpired: "Истёк",
  neverExpires: "Бессрочно",
  revokeButton: "Отозвать",
  revokeAction: "отозвать токен",
  revokedToast: "Токен отозван",
  confirmRevokeTitle: "Отозвать токен?",
  confirmRevokeDesc:
    "Все клиенты с этим токеном немедленно потеряют доступ. Действие необратимо.",
  emptyTitle: "Токенов пока нет",
  emptyDesc: "Создайте токен, чтобы подключить внешний сервис.",

  // --- Копирование (copy-button.tsx) ---
  copyLabel: "Копировать",
  copiedLabel: "Скопировано",
  copiedToast: "Скопировано",
  copyFailTitle: "Не удалось скопировать",
  copyFailDesc: "Скопируйте вручную.",

  // --- Трекинг использования (usage-tracking-toggle.tsx) ---
  usageTrackingHeading: "Трекинг использования",
  usageTrackingIntro:
    "Когда включён, для каждого токена записываются число запросов и время последнего использования.",
  usageTrackingEnabledStatus: "Трекинг включён.",
  usageTrackingDisabledStatus: "Трекинг выключен.",
  usageTrackingEnableButton: "Включить трекинг",
  usageTrackingDisableButton: "Выключить трекинг",
  usageTrackingDisableDialogTitle: "Выключить трекинг использования?",
  usageTrackingDisableDialogDescription:
    "Все накопленные счётчики (число запросов и время последнего обращения) будут удалены безвозвратно.",
  usageTrackingDisableConfirmLabel: "Выключить и удалить",
  usageTrackingSavedTitle: "Сохранено",
  usageTrackingEnabledToast: "Трекинг использования включён.",
  usageTrackingDisabledToast: "Трекинг выключен, счётчики удалены.",
  usageTrackingManageAction: "изменить настройки трекинга",
  // колонки таблицы токенов
  colLastUsed: "Последнее использование",
  colRequests: "Запросов",

  // --- Ошибки запроса (api.ts) ---
  api: {
    loadFailed: "Не удалось загрузить токены",
  },
};

export default tokens;
