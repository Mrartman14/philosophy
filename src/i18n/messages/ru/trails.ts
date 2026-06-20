// src/i18n/messages/ru/trails.ts
// UI-строки слайса trails (маршруты чтения).
const trails = {
  // --- trail-create-form ---
  createTitleLabel: "Название",
  createTitlePlaceholder: "Название маршрута",
  createDescriptionLabel: "Описание",
  createDescriptionPlaceholder: "Краткое описание (необязательно)",
  createVisibilityLabel: "Видимость",
  createVisibilityPrivate: "Приватный",
  createVisibilityPublic: "Публичный",
  createVisibilityNote: "Публичный маршрут нельзя будет вернуть в приватный — только удалить.",
  createSubmit: "Создать",
  createForbiddenAction: "создание маршрута",

  // --- trail-meta-form ---
  metaTitleLabel: "Название",
  metaDescriptionLabel: "Описание",
  metaSubmit: "Сохранить",
  metaSaved: "Сохранено.",

  // --- trail-delete-button ---
  deleteButton: "Удалить",
  deleteDialogTitle: "Удалить маршрут?",
  deleteDialogDescription: "Действие необратимо. Лекции в маршруте удалены не будут — только сам маршрут.",
  deleteDialogConfirm: "Удалить",
  deleteAction: "удаление маршрута",
  deleteForbiddenTitle: "Не удалось удалить",
  deleteFailureTitle: "Не удалось удалить",

  // --- trail-items-editor ---
  itemsHeading: "Содержимое маршрута",
  itemsEmpty: "Маршрут пуст. Добавьте документы.",
  itemsMoveUp: "Вверх",
  itemsMoveDown: "Вниз",
  itemsRemove: "Убрать",
  itemsPickerCancel: "Отмена",
  itemsAddDocument: "+ Добавить документ",
  itemsSaveSubmit: "Сохранить содержимое",
  itemsSavedTitle: "Сохранено",
  itemsSavedDescription: "Содержимое маршрута обновлено.",
  itemsErrorTitle: "Ошибка",
  itemsAlreadyAddedTitle: "Уже добавлен",
  itemsAlreadyAddedDescription: "Этот документ уже в маршруте.",
  itemsForbiddenAction: "изменение маршрута",
  itemsValidationError: "Проверьте список документов.",

  // --- trail-visibility-button ---
  visibilityMakePublic: "Сделать публичным",
  visibilityForbiddenAction: "изменение видимости",

  // --- trail-detail ---
  detailDocumentsHeading: "Документы маршрута",
  detailDocumentsEmpty: "В маршруте пока нет документов.",

  // --- trail-my-list ---
  myListEmpty: "У вас пока нет маршрутов.",
  myListUntitled: "Без названия",
  visibilityPrivate: "приватный",
  visibilityPublic: "публичный",

  // --- trail-public-list ---
  publicListEmpty: "Маршрутов пока нет.",
  publicListUntitled: "Без названия",

  // --- trail-admin-row ---
  adminUntitled: "Без названия",
  adminAuthorLabel: "автор",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Не удалось загрузить маршруты",
    loadItemFailed: "Не удалось загрузить маршрут",
  },
};

export default trails;
