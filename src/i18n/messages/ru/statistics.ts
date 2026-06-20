// src/i18n/messages/ru/statistics.ts
// UI-строки слайса statistics.
const statistics = {
  // --- entity type labels (view-stats, production-stats-table) ---
  entityType: {
    lecture: "Лекции",
    document: "Документы",
    trail: "Маршруты",
    canvas: "Канвасы",
    form: "Формы",
    media: "Медиа",
    annotation: "Аннотации",
    comment: "Комментарии",
  },

  // --- view-stats ---
  trackingDisabledTitle: "Трекинг просмотров выключен",
  trackingDisabledDescription:
    "Включите его в настройках, чтобы видеть статистику просмотров.",
  goToSettings: "Перейти в настройки",
  noViewsTitle: "Вы пока ничего не просматривали",
  noViewsDescription: "Статистика появится после первых просмотров материалов.",
  totalViews: "Всего просмотров:",
  untitled: "Без названия",
  unavailable: "Недоступно",
  viewCount: "{count} просм.",

  // --- production-stats-table ---
  noProductionTitle: "Вы пока ничего не создали",
  noProductionDescription:
    "Здесь появится статистика по вашим лекциям, документам и другим материалам.",
  colType: "Тип",
  colTotal: "Всего",
  colPublic: "Публичных",
  colPrivate: "Приватных",
  totalsRow: "Итого",

  // --- history-tracking-toggle ---
  savedTitle: "Сохранено",
  trackingEnabledDescription: "Трекинг просмотров включён.",
  trackingDisabledAfterPurge: "Трекинг выключен, история удалена.",
  trackingEnabledStatus: "Трекинг просмотров включён.",
  trackingDisabledStatus: "Трекинг просмотров выключен.",
  disableButton: "Выключить",
  enableButton: "Включить",
  disableDialogTitle: "Выключить трекинг?",
  disableDialogDescription: "Вся история просмотров будет удалена безвозвратно.",
  disableConfirmLabel: "Удалить историю",
  // Действие для «У вас нет прав на {action}.»
  manageSettingsAction: "изменение настроек",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadStatsFailed: "Не удалось загрузить статистику",
    loadViewStatsFailed: "Не удалось загрузить статистику просмотров",
    loadHistorySettingsFailed: "Не удалось загрузить настройки истории",
  },
};

export default statistics;
