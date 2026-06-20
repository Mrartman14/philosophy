// src/i18n/messages/ru/search.ts
const search = {
  // --- Форма поиска (search-input.tsx) ---
  filterAll: "Везде",
  filterLectures: "Лекции",
  filterTerms: "Термины",
  inputPlaceholder: "Поиск по лекциям и терминам",
  inputAriaLabel: "Поисковый запрос",
  filterAriaLabel: "Тип результата",
  submitButton: "Найти",
  headerInputPlaceholder: "Поиск…",
  headerSubmitAriaLabel: "Искать",
  headerOpenAriaLabel: "Открыть поиск",

  // --- Результаты поиска (search-results.tsx) ---
  typeLecture: "Лекция",
  typeGlossary: "Термин",
  untitled: "Без названия",
  hitFallbackTitle: "Результат",
  emptyTitle: "Ничего не найдено",
  emptyDescription: "Попробуйте изменить запрос или снять фильтр по типу.",
  foundCount: "Найдено: {total}",

  // --- Экспорт (search-export-links.tsx) ---
  exportLabel: "Экспорт:",

  // --- Скелетон загрузки (search-results-skeleton.tsx) ---
  loadingAriaLabel: "Загрузка результатов…",

  // --- Ошибки запроса (api.ts) ---
  api: {
    fetchFailed: "Не удалось выполнить поиск",
  },

  // --- Валидация (validation namespace: search секция) ---
  // Перенесены в validation.search.*
};

export default search;
