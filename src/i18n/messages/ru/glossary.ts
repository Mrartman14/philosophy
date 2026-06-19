// src/i18n/messages/ru/glossary.ts
// Per-feature namespace для слайса glossary.
const glossary = {
  // --- glossary-admin-row ---
  editButton: "Редактировать",

  // --- glossary-create-form ---
  titleLabel: "Название",
  titlePlaceholder: "Например: «Эпистемология»",
  createButton: "Создать",
  // Action для «У вас нет прав на {action}.» (Case 3) — forbiddenAction в FormFeedback.
  // ОТЛОЖЕНО: FormFeedback.forbiddenAction — frozen seam; строка локализована здесь для
  // будущего Case 3, но сам prop пока остаётся захардкоженным (см. concerns).
  createTermAction: "создание термина",

  // --- glossary-delete-button ---
  deleteButton: "Удалить",
  deleteConfirmTitle: "Удалить термин?",
  deleteConfirmDescription:
    "Действие необратимо. Если на блоки термина ссылаются другие материалы — удаление будет отклонено.",
  deleteConfirmLabel: "Удалить",
  // Action для toastActionError — frozen seam (action-toast.ts);
  // строка здесь для документации, вызов оставлен с литералом.
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
};

export default glossary;
