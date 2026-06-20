// src/i18n/messages/ru/search.ts
const search = {
  // --- Форма поиска (search-input.tsx) ---
  inputPlaceholder: "Поиск по документам и терминам",
  inputAriaLabel: "Поисковый запрос",
  submitButton: "Найти",
  headerInputPlaceholder: "Поиск…",
  headerSubmitAriaLabel: "Искать",
  headerOpenAriaLabel: "Открыть поиск",

  // --- Результаты поиска (search-results.tsx) ---
  typeDocument: "Документ",
  typeGlossary: "Термин",
  untitled: "Без названия",
  emptyTitle: "Ничего не найдено",
  emptyDescription: "Попробуйте переформулировать запрос.",
  foundCount: "Найдено: {count}",

  // --- Скелетон загрузки (search-results-skeleton.tsx) ---
  loadingAriaLabel: "Загрузка результатов…",

  // --- Ошибки запроса (api.ts) ---
  api: {
    fetchFailed: "Не удалось выполнить поиск",
  },
};

export default search;
