// src/i18n/messages/ru/documents.ts
// UI-строки слайса documents. Zod-ошибки форм — в validation.documents.*.
// api-error коды — в errors.ts (Case 2).
const documents = {
  // --- UI-labels (shared) ---
  titleLabel: "Название",
  contentLabel: "Содержимое",
  visibilityLabel: "Видимость",
  visibilityPrivate: "Приватный",
  visibilityPublic: "Публичный",
  titlePlaceholder: "Название документа",
  fileLabel: "Файл Markdown (.md)",
  noTitle: "Без названия",

  // --- visibility warning ---
  publicWarning: "Публичный документ нельзя будет вернуть в приватный — только удалить.",

  // --- buttons ---
  createButton: "Создать",
  saveContentButton: "Сохранить содержимое",
  saveTitleButton: "Сохранить название",
  uploadButton: "Загрузить",
  makePublicButton: "Сделать публичным",
  deleteButton: "Удалить",

  // --- saved/status ---
  savedMessage: "Сохранено.",

  // --- empty states ---
  emptyDocument: "Документ пуст.",
  emptyMyList: "У вас пока нет документов.",

  // --- admin row ---
  authorLabel: "автор",

  // --- containers panel ---
  containersPanelTitle: "Включён в лекции",
  containersEmpty: "Документ не включён ни в одну лекцию.",
  containerLinkLabel: "Лекция {id}",

  // --- delete dialog ---
  deleteDialogTitle: "Удалить документ?",
  deleteDialogDescription:
    "Действие необратимо. Если на документ ссылаются материалы — удаление будет отклонено.",
  deleteDialogConfirm: "Удалить",

  // --- forbidden actions (Case 3: действие в родительном падеже для errors.forbiddenAction) ---
  editForbiddenAction: "изменение документа",
  visibilityForbiddenAction: "изменение видимости",
  createAction: "создание документа",
  uploadAction: "загрузку документа",
  deleteAction: "удаление документа",

  // --- conflict merge (AstMergeView) ---
  merge: {
    title: "Документ изменён в другом месте",
    intro:
      "Пока вы редактировали, документ сохранил другой пользователь. Объедините изменения поблочно.",
    badgeServerChanged: "изменено на сервере",
    badgeYourEdit: "ваша правка",
    badgeAddedByYou: "добавлено вами",
    badgeAddedOnServer: "добавлено на сервере",
    badgeRemovedByYou: "удалено вами",
    badgeRemovedOnServer: "удалено на сервере",
    conflictHeading: "Конфликт — выберите версию блока",
    optionServer: "Серверная версия",
    optionMine: "Ваша версия",
    unchangedLabel: "блоков без изменений",
    applyButton: "Применить и продолжить",
    cancelButton: "Отмена",
    goneMessage:
      "Документ был удалён в другом месте. Скопируйте свои правки и обновите страницу.",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadMyFailed: "Не удалось загрузить документы",
    loadItemFailed: "Не удалось загрузить документ",
    loadContainersFailed: "Не удалось загрузить привязки",
    loadRevisionsFailed: "Не удалось загрузить ревизии",
    loadRevisionFailed: "Не удалось загрузить ревизию",
    loadAdminFailed: "Не удалось загрузить документы",
  },
};

export default documents;
