// src/i18n/messages/ru/tags.ts
// UI-строки слайса tags (создание/переименование/удаление тегов, назначение лекции).
const tags = {
  // --- UI: tag-create-form ---
  newTagLabel: "Новый тег",
  namePlaceholder: "Например: «этика»",
  tagCreated: "Тег «{name}» создан.",
  createButton: "Создать",
  createTagAction: "создание тега",

  // --- UI: tag-admin-row ---
  rename: "Переименовать",
  cancel: "Отмена",
  newNameLabel: "Новое имя",
  saveButton: "Сохранить",
  renameTagAction: "переименование тега",

  // --- UI: tag-delete-button ---
  deleteButton: "Удалить",
  deleteTitle: "Удалить тег «{name}»?",
  deleteDescription: "Тег будет снят со всех лекций. Действие необратимо.",
  deleteTagAction: "удаление тега",

  // --- UI: lecture-tags-form ---
  noTagsHint: "Тегов пока нет. Создайте их на странице «Теги» в админке.",
  saveTags: "Сохранить теги",
  tagsSaved: "Теги сохранены.",
  assignTagsAction: "назначение тегов",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Не удалось загрузить теги",
    loadLectureTagsFailed: "Не удалось загрузить теги лекции",
  },
};

export default tags;
