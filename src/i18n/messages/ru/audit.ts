// src/i18n/messages/ru/audit.ts
// Namespace UI-строк слайса audit (журнал администратора).
const audit = {
  // --- audit-filter-form: метки полей и кнопки ---
  filterAllTypes: "Все типы",
  filterActorLabel: "ID актора (UUID)",
  filterTargetTypeLabel: "Тип цели",
  filterTargetIdLabel: "ID цели",
  filterTargetIdPlaceholder: "ID сущности",
  filterActionLabel: "Действие",
  filterActionPlaceholder: "Например, lecture.create",
  filterFromLabel: "С",
  filterToLabel: "По",
  filterSubmit: "Фильтровать",
  filterReset: "Сбросить",

  // --- admin audit page ---
  pageTitle: "Аудит",
  pageDescription: "Журнал админ-действий. Всего записей: {total}",
  metaTitle: "Аудит — админ",

  // --- audit-table: заголовки и пустое состояние ---
  colTime: "Время",
  colActor: "Актор",
  colAction: "Действие",
  colTarget: "Цель",
  colDetails: "Детали",
  detailsToggle: "Показать",
  emptyTitle: "Записей не найдено",
  emptyDescription: "Попробуйте ослабить фильтры или расширить период.",
};

export default audit;
