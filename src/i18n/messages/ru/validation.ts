// src/i18n/messages/ru/validation.ts
// Zod-сообщения форм. Схемы — server-only фабрики makeXSchema(t), где
// t = getT("validation") разрешает ключ при parseFormData (request-scope).
// Переиспользуемые сообщения (required/maxLen с {n}) — секция common;
// per-форма строки — под ключом-неймспейсом формы.
const validation = {
  // --- переиспользуемые ---
  required: "Обязательное поле",
  maxLen: "До {n} символов",

  // --- общие сообщения, используемые в нескольких формах ---
  common: {
    // «Введите название» — canvas/lectures/documents/trails/events/forms
    titleRequired: "Введите название",
    // «Тело должно быть массивом блоков» — documents/banners/events/glossary
    blocksNotArray: "Тело должно быть массивом блоков",
    // «Некорректная дата» — shareLinks/audit
    invalidDate: "Некорректная дата",
  },

  // --- preferences: push.SendRequest (POST /api/admin/push/send) ---
  pushSend: {
    titleRequired: "Введите заголовок",
    titleMax: "До 200 символов",
    bodyMax: "До 1000 символов",
    urlFormat: "URL должен начинаться с «/» или «http(s)://»",
  },
  // --- preferences: push subscribe/unsubscribe ---
  pushSubscribe: {
    endpoint: "Не удалось оформить подписку на уведомления.",
    p256dh: "Пустой ключ p256dh",
    auth: "Пустой ключ auth",
  },

  // --- auth: login (POST /api/auth/login) ---
  login: {
    usernameRequired: "Введите логин",
    usernameMax: "Слишком длинный логин",
    passwordRequired: "Введите пароль",
    passwordMax: "Слишком длинный пароль",
  },

  // --- auth: register (POST /api/auth/register) ---
  register: {
    usernameMin: "Логин — минимум 3 символа",
    usernameMax: "Логин — максимум 30 символов",
    passwordMin: "Пароль — минимум 6 символов",
    passwordMax: "Слишком длинный пароль",
    passwordConfirmMismatch: "Пароли не совпадают",
  },

  // --- canvas: CanvasCreateSchema / CanvasUpdateSchema / CanvasIdSchema ---
  canvas: {
    titleMax: "До 200 символов",
    invalidId: "Некорректный id канваса",
    badJson: "Битый JSON в данных графа",
    graphInvalid: "Граф не прошёл валидацию",
    etagMissing: "Не удалось определить версию канваса — обновите страницу.",
    // CanvasDataSchema superRefine (node/edge structural errors)
    duplicateNodeId: "Повторяющийся идентификатор узла \"{id}\"",
    edgeFromNotFound: "Ребро \"{edgeId}\": узел-источник \"{nodeId}\" не найден",
    edgeToNotFound: "Ребро \"{edgeId}\": узел-получатель \"{nodeId}\" не найден",
  },

  // --- comments: createComment / updateCommentBlocks form schemas ---
  comments: {
    invalidType: "Неизвестный тип комментария",
    invalidParentId: "Некорректный parent_id",
    invalidCommentId: "Некорректный id комментария",
    blocksInvalidJson: "Не удалось обработать текст комментария. Обновите страницу и попробуйте снова.",
    blocksNotArray: "Комментарий не может быть пустым",
    blocksEmpty: "Комментарий не может быть пустым",
    anchorNotObject: "Якорь должен быть объектом",
    anchorInvalidJson: "Не удалось обработать выделение. Выделите фрагмент заново.",
  },

  // --- lectures: LectureCreateSchema / LectureUpdateSchema / etc. ---
  lectures: {
    titleMax: "До 200 символов",
    descriptionMax: "До 5000 символов",
    dateFormat: "Дата должна быть в формате ГГГГ-ММ-ДД",
    invalidId: "Некорректный id лекции",
    imageRequired: "Не выбрано изображение",
    altMax: "До 500 символов",
    entityRequired: "Не выбрана сущность",
    blocksMin: "Нужен хотя бы один блок",
  },

  // --- documents: DocumentCreateSchema / DocumentBlocksSchema / DocumentMetaSchema / etc. ---
  documents: {
    titleMax: "До 500 символов",
    invalidId: "Некорректный id документа",
    blocksMinLength: "Тело документа не может быть пустым",
    blocksInvalidJson: "Не удалось обработать текст документа. Обновите страницу и попробуйте снова.",
    blocksEmpty: "Добавьте хотя бы один блок",
  },

  // --- banners: BannerFieldsSchema / BannerUpdateSchema / BannerIdSchema ---
  banners: {
    variantRequired: "Выберите тип баннера",
    audienceRequired: "Выберите аудиторию",
    dismissibleInvalid: "Некорректное значение «можно скрыть»",
    startAtRequired: "Укажите начало показа",
    startAtInvalid: "Укажите дату и время начала показа",
    endAtInvalid: "Укажите дату и время окончания показа",
    endAtBeforeStart: "Окончание показа должно быть позже начала",
    eventIdUuid: "Некорректный ID события",
    blocksInvalidJson: "Не удалось обработать текст баннера. Обновите страницу и попробуйте снова.",
    invalidId: "Некорректный id баннера",
  },

  // --- trails: TrailCreateSchema / TrailMetaSchema / TrailItemsSchema / TrailIdSchema ---
  trails: {
    titleMax: "До 200 символов",
    descriptionMax: "До 2000 символов",
    invalidId: "Некорректный id маршрута",
    documentIdsRequired: "Список не задан",
    documentIdsBadJson: "Не удалось обработать список документов. Обновите страницу.",
    documentIdsNotArray: "Список должен быть массивом",
    documentItemNotString: "Элемент списка не строка",
    documentItemInvalidId: "Некорректный id документа",
    documentItemDuplicate: "Документ добавлен дважды",
  },

  // --- events: EventFieldsSchema / EventCreateSchema / EventUpdateSchema / EventIdSchema ---
  events: {
    titleMax: "До 500 символов",
    startDateRequired: "Укажите дату начала",
    rruleMax: "До 500 символов",
    dateFormat: "Формат даты — ГГГГ-ММ-ДД",
    startDateTimeRequired: "Укажите дату и время начала",
    endDateTimeRequired: "Укажите дату и время окончания",
    endBeforeStart: "Дата окончания раньше даты начала",
    rrulePrefix: "RRULE должен начинаться с FREQ=",
    blocksInvalidJson: "Не удалось обработать описание события. Обновите страницу и попробуйте снова.",
    invalidId: "Некорректный id события",
  },

  // --- annotations: AnnotationCreateSchema / AnnotationUpdateSchema ---
  annotations: {
    blocksMinLength: "Тело аннотации не может быть пустым",
    blocksInvalidJson: "Не удалось обработать текст аннотации. Обновите страницу и попробуйте снова.",
    blocksNotArray: "Тело должно быть непустым массивом блоков",
    blocksEmpty: "Тело должно быть непустым массивом блоков",
    anchorNotObject: "Якорь должен быть объектом",
    anchorInvalidJson: "Не удалось обработать выделение. Выделите фрагмент заново.",
    invalidParentId: "Некорректный id родительской сущности",
    invalidAnnotationId: "Некорректный id аннотации",
    offsetMin: "offset >= 0",
  },

  // --- share-links: ExpiresAtSchema / ShareLinkCreateSchema / RevokeTokenSchema ---
  shareLinks: {
    resourceIdRequired: "Укажите ID ресурса",
    tokenRequired: "Токен обязателен",
  },

  // --- users: UserRoleUpdateSchema / UserStatusUpdateSchema ---
  users: {
    invalidId: "Некорректный id пользователя",
  },

  // --- media: MediaIdSchema / MediaVisibilitySchema ---
  media: {
    invalidId: "Некорректный id медиа",
  },

  // --- glossary: TermCreateSchema / TermBlocksUpdateSchema / TermIdSchema ---
  glossary: {
    titleRequired: "Введите название",
    titleMax: "До 300 символов",
    invalidTermId: "Некорректный id термина",
    blocksInvalidJson: "Не удалось обработать тело термина. Обновите страницу и попробуйте снова.",
    blocksMinLength: "Добавьте описание термина.",
    blocksEmpty: "Добавьте описание термина.",
  },

  // --- tags: TagCreateSchema / TagUpdateSchema / TagIdSchema / SetLectureTagsSchema ---
  tags: {
    nameRequired: "Введите имя тега",
    nameMax: "До 100 символов",
    invalidId: "Некорректный id тега",
    invalidLectureId: "Некорректный id лекции",
    tagIdsEmpty: "Не выбрано ни одного тега",
    tagIdsInvalid: "Некорректный список тегов",
    tagIdsBadJson: "Не удалось обработать список тегов. Обновите страницу.",
  },

  // --- audit: фильтры журнала (AuditActorSchema / AuditActionSchema / AuditDateSchema) ---
  audit: {
    invalidActorUuid: "Некорректный ID пользователя",
    invalidActionFormat: "Формат: domain.verb",
  },

  // --- search: SearchQuerySchema ---
  search: {
    queryRequired: "Введите запрос",
    queryMax: "Не более 200 символов",
  },

  // --- tokens: CreateTokenSchema ---
  tokens: {
    labelRequired: "Введите название",
    labelMax: "Не более 100 символов",
    expiresInt: "Введите целое число дней",
    expiresMin: "Минимум 1 день",
    expiresMax: "Не более 90 дней",
  },

  // --- forms: конструктор формы + отправка отклика ---
  forms: {
    invalidId: "Некорректный идентификатор",
    titleMax: "До 500 символов",
    promptRequired: "Текст вопроса обязателен",
    emptyOption: "Пустой вариант",
    choiceRequiresOptions: "Добавьте хотя бы один вариант",
    optionsOnlyForChoice: "Варианты только у полей выбора",
    duplicateOptions: "Варианты не должны повторяться",
    fieldsRequired: "Добавьте хотя бы одно поле",
    duplicateSortOrder: "Дублируется порядок поля #{n}",
    emptyPayload: "Пустая форма",
    badJsonPayload: "Не удалось обработать форму. Обновите страницу и попробуйте снова.",
    payloadStructureError: "Ошибка структуры формы",
    visibilityRequired: "Не указана видимость",
    submissionVisibilityRequired: "Укажите видимость результатов",
    modeRequired: "Не указан режим",
    emptyAnswers: "Нет ответов",
    badJsonAnswers: "Не удалось обработать ответы. Обновите страницу и попробуйте снова.",
    answersNotArray: "Ответы должны быть массивом",
    invalidAnswer: "Некорректный ответ",
  },
};

export default validation;
