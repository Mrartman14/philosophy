// src/i18n/messages/ru/events.ts
// UI-строки слайса events. Zod-сообщения — в validation.ts под ключом events.*.
const events = {
  // --- calendar navigation ---
  prevMonth: "← Предыдущий",
  nextMonth: "Следующий →",
  monthNavLabel: "Навигация по месяцам",
  noEvents: "В этом месяце событий нет.",
  recurringEvent: "Повторяющееся событие",

  // --- event-admin-row ---
  allDayBadge: " · весь день",
  recurringBadge: " · повторяется",
  editLink: "Редактировать",

  // --- event-edit-form / event-create-form labels ---
  fieldTitle: "Название",
  fieldAllDay: "Весь день",
  fieldStartDate: "Дата начала",
  fieldStartDateTime: "Дата и время начала (ваша таймзона)",
  fieldEndDate: "Дата окончания (необязательно)",
  fieldEndDateTime: "Дата и время окончания (ваша таймзона, необязательно)",
  fieldRrule: "Повторение (RRULE, необязательно)",
  fieldBlocks: "Описание события",
  titlePlaceholder: "Например: «Семинар по Канту»",
  clearLimitation:
    "Уже сохранённые «Дату окончания» и «Повторение» очистить нельзя — бекенд игнорирует пустые значения этих полей.",

  // --- event-edit-form status ---
  savedSuccess: "Сохранено.",
  // Case 3: per-feature action phrase (родительный падеж) для forbiddenAction.
  editAction: "изменение события",

  // --- submit buttons ---
  saveButton: "Сохранить",
  createButton: "Создать",

  // Case 3: per-feature action phrase for create form forbiddenAction
  createAction: "создание события",

  // --- event-delete-button ---
  deleteButton: "Удалить",
  deleteDialogTitle: "Удалить событие?",
  deleteDialogDescription:
    "Действие необратимо. Событие исчезнет из публичного календаря.",
  deleteConfirmLabel: "Удалить",
  deleteAction: "удаление события",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Не удалось загрузить события",
    loadItemFailed: "Не удалось загрузить событие",
    loadRevisionsFailed: "Не удалось загрузить ревизии",
    loadRevisionFailed: "Не удалось загрузить ревизию",
    loadCalendarFailed: "Не удалось загрузить календарь",
  },
};

export default events;
