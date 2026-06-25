// src/i18n/messages/ru/lectures.ts
// UI-строки слайса lectures. Zod-ошибки формы — в validation.lectures.*.
const lectures = {
  // --- validation: Zod-сообщения форм (validation.lectures.*) переехали в validation.ts ---
  // --- UI-labels ---
  titleLabel: "Название",
  dateLabel: "Дата",
  dateDescription: "Формат ГГГГ-ММ-ДД",
  descriptionLabel: "Описание",
  visibilityLabel: "Видимость",
  visibilityPrivate: "Приватная",
  visibilityPublic: "Публичная",
  allTags: "Все теги",

  // --- buttons / actions ---
  saveButton: "Сохранить",
  createButton: "Создать",
  deleteButton: "Удалить",
  editLink: "Редактировать",
  searchButton: "Найти",
  searchPending: "…",
  replaceCover: "Заменить обложку",
  uploadCover: "Загрузить обложку",
  deleteCover: "Удалить обложку",

  // --- cover form ---
  coverSectionLabel: "Обложка лекции",
  coverHeading: "Обложка",
  coverAlt: "Обложка лекции",
  coverEmpty: "Обложка не задана.",
  coverAltLabel: "Alt-текст (для доступности)",

  // --- delete dialog ---
  deleteDialogTitle: "Удалить лекцию?",
  deleteDialogDescription: "Действие необратимо.",

  // --- search form ---
  searchPlaceholder: "Поиск по названию или описанию",
  searchAriaLabel: "Поиск лекций",
  tagFilterAriaLabel: "Фильтр по тегу",

  // --- list empty state ---
  emptyTitle: "Лекций не найдено",
  emptyDescription: "Попробуйте изменить фильтры или поиск.",

  // --- edit form status ---
  savedMessage: "Сохранено.",

  // --- document tabs (карточка лекции) ---
  documentTabsAriaLabel: "Документы лекции",
  docTabLoading: "Загрузка документа…",
  docTabError: "Не удалось загрузить документ.",
  docTabEmpty: "Пустой документ.",

  // --- attachments manager ---
  detachForbidden: "У вас нет прав на открепление.",
  reorderForbidden: "У вас нет прав на изменение порядка.",
  attachForbidden: "У вас нет прав на прикрепление.",
  searchDocumentPlaceholder: "Поиск документа…",
  searchMediaPlaceholder: "Поиск медиа…",
  attachmentsEmpty: "Пока ничего не прикреплено.",

  // --- attach docs on create (Вариант A) ---
  attachDocsLabel: "Прикрепить документы",
  attachDocsHint: "Необязательно. Выберите уже созданные документы — они прикрепятся к лекции после её создания.",
  attachDocsRemove: "Убрать {label}",

  // --- forbidden actions (Case 3 действие в родительном падеже) ---
  coverForbiddenAction: "изменение обложки",
  visibilityForbiddenAction: "смену видимости",
  editForbiddenAction: "редактирование",
  createAction: "создание лекции",
  deleteAction: "удаление лекции",

  // --- api-error codes (Case 2 — keys for errors namespace) ---
  // (NB: эти ключи живут в errors.ts, здесь только для справки — см. ERRORS в actions.ts)

  // --- server throws (api.ts fallback messages) ---
  api: {
    loadListFailed: "Не удалось загрузить лекции",
    loadItemFailed: "Не удалось загрузить лекцию",
    loadDocumentsFailed: "Не удалось загрузить документы лекции",
    loadMediaFailed: "Не удалось загрузить медиа лекции",
  },
};

export default lectures;
