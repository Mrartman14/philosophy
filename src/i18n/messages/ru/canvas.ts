// src/i18n/messages/ru/canvas.ts
// UI-строки фичи canvas. Клиентские компоненты используют useT("canvas"),
// серверные — await getT("canvas").
const canvas = {
  // --- canvas-create-form ---
  createForm: {
    titleLabel: "Название",
    visibilityLabel: "Видимость",
    dataLabel: "Данные графа (JSON, необязательно)",
    // ICU: фигурные скобки экранируем одинарными кавычками, иначе {"nodes"…}
    // парсится next-intl как (битый) плейсхолдер → выводится сам ключ.
    dataDescription: "Например: '{\"nodes\":[],\"edges\":[]}'",
    visibilityPrivate: "Приватный",
    visibilityPublic: "Публичный",
    submitCreate: "Создать",
    toastCreatedTitle: "Канвас создан",
    toastErrorTitle: "Ошибка",
  },

  // --- canvas-edit-form ---
  editForm: {
    titleLabel: "Название",
    dataLabel: "Данные графа (JSON)",
    submitSave: "Сохранить",
    toastSavedTitle: "Сохранено",
    toastErrorTitle: "Ошибка",
  },

  // --- canvas-delete-button ---
  deleteButton: {
    trigger: "Удалить",
    title: "Удалить канвас?",
    description: "Действие необратимо.",
    confirmLabel: "Удалить",
    toastDeletedTitle: "Канвас удалён",
  },

  // --- canvas-visibility-button ---
  visibilityButton: {
    makePublic: "Сделать публичным",
    toastPublishedTitle: "Канвас опубликован",
    toastErrorTitle: "Ошибка",
  },

  // --- canvas-editor ---
  editor: {
    ariaLabel: "Редактор холста",
    toastValidationTitle: "Граф не прошёл проверку",
    toastValidationFallback: "Исправьте ошибки.",
    toastSavedTitle: "Сохранено",
    toastSaveErrorTitle: "Ошибка сохранения",
    toastCopiedTitle: "Скопировано в буфер обмена",
    toastCopyErrorTitle: "Не удалось скопировать",
    confirmLeave: "Есть несохранённые изменения. Уйти без сохранения?",
    titleRequired: "Введите название.",
  },

  // --- editor-toolbar ---
  toolbar: {
    back: "Назад",
    addText: "Текст",
    addRect: "Прямоуг.",
    addEllipse: "Эллипс",
    addDiamond: "Ромб",
    addLink: "Ссылка",
    deleteSelected: "Удалить",
    undoAriaLabel: "Отменить",
    redoAriaLabel: "Повторить",
    reset: "Откатить",
    toolSelect: "Выделение",
    toolHand: "Рука",
    fit: "Показать всё",
    grid: "Линейки",
    showCanvas: "Холст",
    showJson: "JSON",
    export: "Скачать",
    exportSvg: "Скачать SVG",
    exportPng: "Скачать PNG",
    exportJson: "Скачать JSON",
    copyJson: "Скопировать как JSON",
    unsavedChanges: "Есть несохранённые изменения",
    saving: "Сохранение…",
    save: "Сохранить",
    create: "Создать",
  },

  // --- editor context menu (right-click) ---
  contextMenu: {
    center: "Центрировать",
    bringToFront: "На передний план",
    sendToBack: "На задний план",
    delete: "Удалить",
  },

  // --- editor-inspector ---
  inspector: {
    emptyHint: "Выберите узел или ребро.",
    nodeHeading: "Узел: {type}",
    shapeLabel: "Фигура",
    shapeAriaLabel: "Фигура",
    shapeRect: "Прямоугольник",
    shapeEllipse: "Эллипс",
    shapeDiamond: "Ромб",
    widthLabel: "Ширина",
    heightLabel: "Высота",
    edgeHeading: "Ребро",
    edgeCaptionLabel: "Подпись",
    edgeStyleLabel: "Стиль",
    edgeStyleAriaLabel: "Стиль",
    edgeStyleSolid: "Сплошная",
    edgeStyleDashed: "Пунктир",
    edgeEndLabel: "Конец",
    edgeEndAriaLabel: "Конец",
    edgeEndArrow: "Стрелка",
    edgeEndNone: "Без стрелки",
    edgeFromSideLabel: "От стороны",
    edgeFromSideAriaLabel: "От стороны",
    edgeToSideLabel: "К стороне",
    edgeToSideAriaLabel: "К стороне",
    sideAuto: "авто",
    sideTop: "сверху",
    sideRight: "справа",
    sideBottom: "снизу",
    sideLeft: "слева",
  },

  // --- entity-ref-dialog ---
  entityRefDialog: {
    title: "Добавить ссылку на сущность",
    typeLabel: "Тип сущности",
    typeAriaLabel: "Тип сущности",
    idLabel: "ID сущности (UUID)",
    addButton: "Добавить",
    typeDocument: "Документ",
    typeGlossary: "Глоссарий",
    typeMedia: "Медиа",
    typeCanvas: "Канвас",
    typeComment: "Комментарий",
    typeAnnotation: "Аннотация",
    typeForm: "Форма",
    typeBanner: "Баннер",
    typeEvent: "Событие",
  },

  // --- entity-ref-метки (resolveEntityRefView; node-плашка ссылки на сущность) ---
  // 9 типов entity_ref + fallback для неизвестного типа.
  entityType: {
    document: "Документ",
    media: "Медиа",
    comment: "Комментарий",
    glossary: "Глоссарий",
    form: "Форма",
    canvas: "Канвас",
    annotation: "Аннотация",
    banner: "Баннер",
    event: "Событие",
    fallback: "Объект",
  },

  // --- canvas-my-list ---
  myList: {
    empty: "Канвасов пока нет.",
    untitled: "Без названия",
    visibilityPublic: "публичный",
    visibilityPrivate: "приватный",
  },

  // --- canvas-containers ---
  containers: {
    title: "Включён в лекции",
    emptyText: "Канвас не включён ни в одну лекцию.",
    lectureLabel: "Лекция {id}",
  },

  // --- canvas-revisions ---
  revisions: {
    versionLabel: "Версия {num}",
  },

  // --- canvas-search ---
  search: {
    placeholder: "Поиск по названию",
    submit: "Найти",
  },

  // --- editor/validate.ts (структурная валидация графа; ключи + ICU-параметры) ---
  validate: {
    tooManyNodes: "Слишком много узлов: {count} > {max}",
    tooManyEdges: "Слишком много рёбер: {count} > {max}",
    nodeNoId: "У узла нет id",
    duplicateNodeId: 'Дубликат id узла "{id}"',
    nodeSizePositive: 'Узел "{id}": размеры должны быть положительными',
    textNodeNoText: 'Текстовый узел "{id}" без текста',
    nodeTextTooLong: 'Узел "{id}": текст слишком длинный',
    shapeNoKind: 'Фигура "{id}" без типа фигуры',
    entityRefNoType: 'Ссылка "{id}" без типа сущности',
    entityRefNoId: 'Ссылка "{id}" без id сущности',
    nodeUnknownType: 'Узел "{id}": неизвестный тип',
    edgeNoId: "У ребра нет id",
    edgeFromNotFound: 'Ребро "{id}": from_node не найден',
    edgeToNotFound: 'Ребро "{id}": to_node не найден',
    edgeLabelTooLong: 'Ребро "{id}": подпись слишком длинная',
  },

  // --- forbidden actions (for Case 3 per-feature action strings) ---
  // These are passed as {action} in errors.forbiddenAction
  createForbiddenAction: "создание канваса",
  updateForbiddenAction: "изменение канваса",
  editorUpdateForbiddenAction: "изменение канваса",
  deleteForbiddenAction: "удаление канваса",
  visibilityForbiddenAction: "изменение видимости канваса",

  // --- api.ts: fetch error messages (thrown to React error boundary) ---
  api: {
    loadCanvasesFailed: "Не удалось загрузить канвасы",
    loadCanvasFailed: "Не удалось загрузить канвас",
    loadRevisionsFailed: "Не удалось загрузить ревизии",
    loadRevisionFailed: "Не удалось загрузить ревизию",
    loadContainersFailed: "Не удалось загрузить привязки",
  },
};

export default canvas;
