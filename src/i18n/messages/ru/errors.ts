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

  // --- comments slice: доменные коды ---
  SELF_REACTION: "Нельзя реагировать на собственный комментарий.",
  AXIS_NOT_ALLOWED: "Эта реакция недоступна для данного типа комментария.",
  INVALID_INSIGHT_VALUE: "Реакция «Инсайт» возможна только со знаком плюс.",
  COMMENT_DELETED: "Комментарий удалён.",
  PARENT_NOT_AVAILABLE: "Родительский комментарий недоступен.",
  PARENT_WRONG_LECTURE: "Родительский комментарий недоступен.",
  INVALID_ROOT_TYPE: "Этот тип комментария нельзя использовать как корневой.",
  INVALID_TYPE_FOR_PARENT:
    "Этот тип комментария недопустим как ответ на выбранный узел.",
  MAX_DEPTH_EXCEEDED: "Превышена максимальная глубина ветки.",
  BLOCKS_EMPTY: "Комментарий не может быть пустым.",
  BLOCKS_INVALID: "Тело комментария не прошло проверку AST.",
  BLOCK_ID_UNKNOWN: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  DUPLICATE_BLOCK_ID: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  COMMENT_REFERENCED:
    "На этот комментарий ссылаются другие материалы. Сначала удалите ссылки.",
  BLOCK_REFERENCED:
    "На блок этого комментария ссылаются извне. Сначала удалите ссылки.",
  // BLOCKS_HAVE_ANCHORS у комментариев отличается от дефолта (document/glossary-контекст):
  // дефолт «Нельзя удалить блок…», здесь «К блокам привязаны другие комментарии…»
  BLOCKS_HAVE_ANCHORS_COMMENT:
    "К блокам этого комментария привязаны другие комментарии. Сначала открепите их.",

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
