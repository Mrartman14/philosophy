// src/i18n/messages/ru/audit.ts
// Namespace UI-строк слайса audit (журнал администратора).
const audit = {
  // --- audit-filter-form: метки полей и кнопки ---
  filterAllTypes: "Все типы",
  filterActorLabel: "ID пользователя",
  filterTargetTypeLabel: "Тип объекта",
  filterTargetIdLabel: "ID объекта",
  filterTargetIdPlaceholder: "ID объекта",
  filterActionLabel: "Действие",
  filterAllActions: "Все действия",
  filterFromLabel: "С",
  filterToLabel: "По",
  filterSubmit: "Фильтровать",
  filterReset: "Сбросить",

  // --- admin audit page ---
  pageTitle: "Аудит",
  pageDescription: "Журнал админ-действий. Всего записей: {total}",

  // --- audit-table: заголовки и пустое состояние ---
  colTime: "Время",
  colActor: "Пользователь",
  colAction: "Действие",
  colTarget: "Объект",
  colDetails: "Детали",
  detailsToggle: "Показать",
  emptyTitle: "Записей не найдено",
  emptyDescription: "Попробуйте ослабить фильтры или расширить период.",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadLogFailed: "Не удалось загрузить журнал аудита",
  },
};

export default audit;
