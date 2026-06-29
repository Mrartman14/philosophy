// src/i18n/messages/ru/notifications.ts
const notifications = {
  // --- Типы уведомлений (notification-item) ---
  documentUpdated:
    "{count, plural, one{Документ, на который вы подписаны, обновлён} few{Документ, на который вы подписаны, обновлён # раза} many{Документ, на который вы подписаны, обновлён # раз} other{Документ, на который вы подписаны, обновлён # раза}}",
  lectureUpdated:
    "{count, plural, one{Лекция, на которую вы подписаны, обновлена} few{Лекция, на которую вы подписаны, обновлена # раза} many{Лекция, на которую вы подписаны, обновлена # раз} other{Лекция, на которую вы подписаны, обновлена # раза}}",
  canvasUpdated:
    "{count, plural, one{Канвас, на который вы подписаны, обновлён} few{Канвас, на который вы подписаны, обновлён # раза} many{Канвас, на который вы подписаны, обновлён # раз} other{Канвас, на который вы подписаны, обновлён # раза}}",
  fallback: "Новое уведомление",
  byActor: "от {actor}",

  // --- Поповер уведомлений (notification-popover) ---
  popoverAriaLabel: "Уведомления",
  popoverHeading: "Уведомления",
  popoverViewAll: "Все",
  popoverLoading: "Загрузка…",
  popoverError: "Не удалось загрузить уведомления.",
  popoverEmpty: "Пока нет уведомлений.",

  // --- Колокольчик (notification-bell) ---
  bellAriaLabel: "Уведомления",

  // --- Действия над списком (notification-list-actions) ---
  markAllReadButton: "Прочитать все",
  markAllReadSuccess: "Все отмечены прочитанными",
  markAllSeenButton: "Просмотреть все",
  markAllSeenSuccess: "Отмечены просмотренными",
  // Action для «У вас нет прав на {action}.» (Case 3 — toastActionError)
  notificationsAction: "уведомления",

  // --- Кнопка подписки (subscribe-button, subscription-row) ---
  subscribeButton: "Подписаться",
  unsubscribeButton: "Отписаться",
  // Action для «У вас нет прав на {action}.» (Case 3 — toastActionError)
  subscribeAction: "подписку",

  // --- Строка подписки (subscription-row) ---
  documentPrefix: "Документ",

  // --- Секция подписок (subscriptions-section) ---
  subscriptionsError: "Не удалось загрузить подписки.",
  subscriptionsEmpty: "У вас нет активных подписок.",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadNotificationsFailed: "Не удалось загрузить уведомления",
    loadCountsFailed: "Не удалось загрузить счётчики",
    loadSubscriptionsFailed: "Не удалось загрузить подписки",
  },
};

export default notifications;
