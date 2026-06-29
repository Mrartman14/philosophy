// src/i18n/messages/ru/editor.ts
// UI-строки AST-редактора (ast-editor компонент).
const editor = {
  // --- Редактор (use-ast-editor) ---
  editorAriaLabel: "Редактор",

  // --- Schema context (schema-context) ---
  schemaUnavailable: "Не удалось загрузить редактор: {message}",

  // --- Image node view (image-node-view) ---
  imageLoading: "Изображение загружается",

  // --- Toolbar: inline marks (inline-marks) ---
  bold: "Жирный",
  italic: "Курсив",
  code: "Код",

  // --- Toolbar: block buttons (block-buttons) ---
  blockquote: "Цитата",
  codeBlock: "Блок кода",
  thematicBreak: "Горизонтальная линия",
  table: "Таблица",

  // --- Toolbar: list buttons (list-buttons) ---
  bulletList: "Маркированный список",
  orderedList: "Нумерованный список",
  checkList: "Чек-лист",
  checkListItem: "Отметить задачу",

  // --- Toolbar: heading select (heading-select) ---
  blockTypeAriaLabel: "Тип блока",
  paragraph: "Параграф",
  heading1: "Заголовок 1",
  heading2: "Заголовок 2",
  heading3: "Заголовок 3",
  heading4: "Заголовок 4",
  heading5: "Заголовок 5",
  heading6: "Заголовок 6",

  // --- Toolbar: link popover (link-popover) ---
  linkAriaLabel: "Ссылка",
  linkUrlAriaLabel: "URL ссылки",
  linkInvalidScheme: "Недопустимая схема ссылки (разрешены http, https, mailto)",
  linkRemove: "Удалить ссылку",
  linkApply: "Применить",

  // --- Toolbar: ref popover (ref-popover) ---
  insertRefAriaLabel: "Вставить ссылку на сущность",

  // --- Toolbar: image button (image-button) ---
  imageAriaLabel: "Изображение",
  imageUploadFailTitle: "Не удалось загрузить изображение",
  imageUploadFailGeneric: "Произошла ошибка. Попробуйте ещё раз.",
  imageUploadForbidden: "У вас нет прав на загрузку изображений.",
  imageUploadTooLarge: "Изображение слишком большое (макс 10 MiB)",
  imageUploadInvalidMime: "Неподдерживаемый формат файла",
  imageUploadNetworkError: "Сетевая ошибка",
  imageUploadNoAccess: "Нет доступа",
  imageUploadFailed: "Ошибка загрузки: {status}",

  // --- Toolbar: slash menu (slash-menu) ---
  slashMenuAriaLabel: "Команды блока",
  slashMenuNoMatches: "Нет совпадений",
  slashMenuClose: "Esc — закрыть",
  slashMenuHeading: "Заголовок {level}",
  slashMenuBlockquote: "Цитата",
  slashMenuCodeBlock: "Блок кода",
  slashMenuBulletList: "Маркированный список",
  slashMenuOrderedList: "Нумерованный список",
  slashMenuCheckList: "Чек-лист",
  slashMenuThematicBreak: "Линия",
  slashMenuTable: "Таблица 3×3",

  // --- Ref menu (ref-menu) ---
  insertRefDialogAriaLabel: "Вставить ссылку",
  refCategoryGlossary: "Термин",
  refCategoryDocument: "Документ",
  refCategoryMedia: "Медиа",
  refCategoryComment: "Комментарий",
  refCategoryAriaLabel: "Тип ссылки",
  refLectureCrumb: "Лекция: {title}",

  // --- Async combobox (async-combobox) ---
  comboboxEmpty: "Ничего не найдено",
  comboboxError: "Ошибка загрузки",
  comboboxLoading: "Загрузка…",
  comboboxRetry: "Повторить",
  comboboxLoadMore: "Загрузить ещё",

  // --- Pickers: placeholders ---
  lecturePlaceholder: "Поиск лекции…",
  glossaryPlaceholder: "Поиск термина…",
  documentPlaceholder: "Поиск документа…",
  mediaPlaceholder: "Поиск медиа…",
  canvasPlaceholder: "Поиск canvas…",
  commentPlaceholder: "Поиск комментария в выбранной лекции…",

  // --- Media picker (media-picker) ---
  mediaTypeLabel: "Тип",
  mediaTypeAll: "все",
  mediaTypeVideo: "видео",
  mediaTypeAudio: "аудио",

  // --- Schema server (schema-server) ---
  schemaLoadError: "Не удалось загрузить редактор",
};

export default editor;
