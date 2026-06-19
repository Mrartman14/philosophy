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

  // --- forms slice: доменные коды ---
  FORM_PUBLISHED: "Форма опубликована — её структуру нельзя менять.",
  FORM_PUBLIC_IMMUTABLE: "Публичную форму нельзя вернуть в приватную.",
  MODE_CHANGE_FORBIDDEN: "Режим «без изменений» нельзя сменить на «редактируемый».",
  FORM_IMMUTABLE_MODE:
    "Эта форма не разрешает редактировать или удалять отклик — только отозвать.",
  RETRACT_NOT_APPLICABLE: "Отзыв доступен только в формах без редактирования отклика.",
  ALREADY_SUBMITTED: "Вы уже отправляли отклик на эту форму.",
  ALREADY_RETRACTED: "Отклик уже отозван.",
  INVALID_FORM_SCHEMA: "Структура формы не прошла проверку на сервере.",
  INVALID_SUBMISSION: "Ответы не прошли проверку. Заполните обязательные поля корректно.",
  FORM_NOT_FOUND: "Форма не найдена.",
  SUBMISSION_NOT_FOUND: "Отклик не найден.",
  FORM_BLOCKS_INVALID: "Описание формы не прошло валидацию.",

  // --- documents slice: доменные коды ---
  // PUBLIC_IMMUTABLE у документов — отдельный ключ, чтобы не перезатирать canvas PUBLIC_IMMUTABLE
  DOCUMENT_PUBLIC_IMMUTABLE: "Публичный документ нельзя сделать приватным.",
  DOCUMENT_REFERENCED:
    "На документ ссылаются другие материалы. Удалите ссылки, затем повторите.",
  DOCUMENT_BLOCK_REFERENCED:
    "На блок документа ссылаются извне. Удалите ссылки или оставьте блок.",
  DOCUMENT_BLOCKS_HAVE_ANCHORS:
    "Нельзя удалить блок с привязанными комментариями. Сначала удалите комментарии.",
  DOCUMENT_BLOCKS_EMPTY: "Документ должен содержать хотя бы один блок.",
  DOCUMENT_BLOCKS_INVALID: "Тело документа не прошло валидацию AST.",
  DOCUMENT_BLOCK_ID_UNKNOWN: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  DOCUMENT_DUPLICATE_BLOCK_ID: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  DOCUMENT_IMAGE_UNKNOWN_KEY: "В документе есть изображение с неизвестным ключом.",

  // --- canvas slice: доменные коды ---
  PUBLIC_IMMUTABLE: "Публичный канвас нельзя сделать приватным.",
  CANVAS_VERSION_MISMATCH:
    "Канвас изменён в другом месте — обновите страницу и повторите.",
  CANVAS_PAYLOAD_TOO_LARGE: "Данные графа слишком большие (лимит 1 МиБ).",
  CANVAS_VALIDATION_ERROR:
    "Граф не прошёл валидацию (узлы/рёбра/ссылки на сущности).",

  // --- banners slice: доменные коды ---
  BANNER_INVALID_COLOR:
    "Бекенд отклонил цвет фона: нужен hex вида #RGB или #RRGGBB.",
  BANNER_INVALID_DATE:
    "Бекенд отклонил даты показа: проверьте формат и порядок начала/окончания.",
  BANNER_INVALID_EVENT: "Событие с таким id не найдено.",
  BANNER_BLOCKS_INVALID: "Текст баннера не прошёл валидацию AST.",
  BANNER_BLOCK_REFERENCED:
    "На блок баннера ссылаются другие материалы. Удалите ссылки или оставьте блок.",
  BANNER_NOT_DISMISSIBLE: "Этот баннер нельзя скрыть.",

  // --- users slice: доменные коды ---
  USER_NOT_FOUND: "Пользователь не найден.",

  // --- lectures slice: доменные коды ---
  UPLOAD_NOT_FOUND: "Загруженное изображение не найдено. Попробуйте ещё раз.",
  ALREADY_ATTACHED: "Эта сущность уже прикреплена к лекции.",
  INVALID_ENTITY_TYPE: "Недопустимый тип сущности.",
  // NOT_FOUND — generic backend-код; не добавляется в глобальный каталог, чтобы
  // isErrorKey не распознавал его как каталожный ключ для всех слайсов.
  // Слайс lectures маппит NOT_FOUND → LECTURE_NOT_FOUND в своей ERRORS-карте.
  LECTURE_NOT_FOUND: "Лекция не найдена.",

  // --- events slice: доменные коды ---
  INVALID_DATE:
    "Бекенд отклонил дату: проверьте формат и порядок дат начала/окончания.",
  INVALID_RRULE: "Бекенд отклонил правило повторения (RRULE).",
  EVENT_BLOCKS_INVALID: "Описание события не прошло валидацию AST.",
  EVENT_BLOCK_REFERENCED:
    "На блок события ссылаются другие материалы. Удалите ссылки или оставьте блок.",

  // --- trails slice: доменные коды ---
  TRAIL_PUBLIC_IMMUTABLE: "Публичный маршрут нельзя сделать приватным — только удалить.",
  TRAIL_DUPLICATE_DOCUMENT: "Документ добавлен в маршрут дважды. Уберите дубликат.",
  TRAIL_DOCUMENT_NOT_FOUND: "Один из документов не найден. Обновите список и повторите.",

  // --- media slice: доменные коды ---
  MEDIA_PUBLIC_IMMUTABLE:
    "Публичное медиа нельзя сделать приватным. Удалите и загрузите заново.",
  MEDIA_NOT_FOUND: "Медиа не найдено.",

  // --- share-links slice: доменные коды ---
  NOT_FOUND: "Ресурс не найден или вы не его владелец.",
  RESOURCE_NOT_PRIVATE: "Ссылку можно создать только для приватного ресурса.",

  // --- preferences slice: доменные коды ---
  NOT_CONFIGURED: "Push-уведомления не настроены на сервере.",

  // --- glossary slice: доменные коды ---
  GLOSSARY_BLOCKS_EMPTY: "Тело термина не может быть пустым.",
  GLOSSARY_BLOCK_REFERENCED:
    "На блок ссылаются другие материалы. Удалите ссылки или оставьте блок.",

  // --- annotations slice: доменные коды ---
  ANNOTATION_BLOCKS_EMPTY: "Тело аннотации не может быть пустым.",
  ANNOTATION_BLOCKS_INVALID: "Тело аннотации не прошло валидацию AST.",
  ANNOTATION_ANCHOR_INVALID: "Некорректная привязка (якорь) аннотации.",
  ANNOTATION_INVALID_PARENT_TYPE: "Аннотации недоступны для этого типа сущности.",
  ANNOTATION_REQUEST_BODY_TOO_LARGE: "Аннотация слишком большая.",

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
