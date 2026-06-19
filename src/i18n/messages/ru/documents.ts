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
};

export default documents;
