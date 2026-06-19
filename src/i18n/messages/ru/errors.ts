// src/i18n/messages/ru/errors.ts
// Доменные коды ошибок бека (api-error) + branded forbidden/suspended/banned.
// Источник истины формы каталога. Ключи api-error зеркалят apperror.Code бека:
// rethrowApiError мапит code → ключ этого namespace, getT("errors") разрешает.
const errors = {
  // --- api-error: коды бекенда (DEFAULT_MESSAGES) ---
  REF_NOT_FOUND: "Одна из ссылок указывает на несуществующий объект.",
  BLOCKS_HAVE_ANCHORS:
    "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок.",
  VERSION_MISMATCH:
    "Объект изменён в другом месте. Обновите страницу и повторите.",
  IF_MATCH_REQUIRED:
    "Не удалось определить версию объекта. Обновите страницу и повторите.",
  IDEMPOTENCY_KEY_IN_USE:
    "Запрос уже обрабатывается. Подождите, не отправляйте повторно.",
  IDEMPOTENCY_KEY_REUSED:
    "Изменённый запрос конфликтует с уже отправленным. Обновите страницу.",
  IDEMPOTENCY_KEY_INVALID:
    "Некорректный ключ идемпотентности. Обновите страницу и повторите.",

  // --- api-error: фоллбеки rethrowApiError (когда у бека нет своего текста) ---
  serverError: "Ошибка сервера",
  accountRestricted: "Аккаунт ограничен.",

  // --- branded forbidden/suspended (UI: action-message / form-feedback / toast) ---
  // {action} — родительный падеж действия, напр. «удаление лекции».
  forbiddenAction: "У вас нет прав на {action}.",
  forbiddenGeneric: "У вас нет прав.",
  forbiddenTitle: "Нет прав",
  failureTitle: "Ошибка",
  unknown: "Неизвестная ошибка",
};

export default errors;
