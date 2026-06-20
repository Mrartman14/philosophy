// src/i18n/messages/ru/glossary.ts
// Per-feature namespace для слайса glossary.
const glossary = {
  // --- glossary-admin-row ---
  editButton: "Редактировать",

  // --- glossary-create-form ---
  titleLabel: "Название",
  titlePlaceholder: "Например: «Эпистемология»",
  createButton: "Создать",
  // Action для «У вас нет прав на {action}.» (Case 3) — prop forbiddenAction в FormFeedback.
  createTermAction: "создание термина",

  // --- glossary-delete-button ---
  deleteButton: "Удалить",
  deleteConfirmTitle: "Удалить термин?",
  deleteConfirmDescription:
    "Действие необратимо. Если на блоки термина ссылаются другие материалы — удаление будет отклонено.",
  deleteConfirmLabel: "Удалить",
  // Action для toastActionError (родительный падеж для errors.forbiddenAction).
  deleteTermAction: "удаление термина",

  // --- glossary-detail ---
  updatedAt: "Обновлено: {date}",

  // --- glossary-edit-form ---
  blocksLabel: "Тело термина",
  savedMessage: "Сохранено.",
  saveButton: "Сохранить",
  // Action для «У вас нет прав на {action}.» (Case 3)
  updateTermAction: "изменение термина",

  // --- glossary-export-links ---
  exportLabel: "Экспорт:",

  // --- glossary-list ---
  emptyState: "Термины не найдены.",
  totalCount: "Всего: {count}",

  // --- glossary-revisions ---
  revisionsTitle: "История ревизий термина",

  // --- glossary-search-form ---
  searchPlaceholder: "Поиск по названию",
  searchButton: "Найти",
  searchPending: "…",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Не удалось загрузить термины",
    loadItemFailed: "Не удалось загрузить термин",
    loadRevisionsFailed: "Не удалось загрузить ревизии термина",
    loadRevisionFailed: "Не удалось загрузить ревизию термина",
  },
};

export default glossary;
