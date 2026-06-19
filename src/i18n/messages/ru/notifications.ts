// src/i18n/messages/ru/notifications.ts
const notifications = {
  // --- Типы уведомлений (notification-item) ---
  documentUpdated: "Документ, на который вы подписаны, обновлён",
  commentCreated:
    "{count, plural, one{# новый комментарий} few{# новых комментария} many{# новых комментариев} other{# новых комментариев}}",
  commentReply: "Ответ на ваш комментарий",
  annotationCreated: "Новая аннотация",
  mention: "Вас упомянули",
  fallback: "Новое уведомление",

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
};

export default notifications;
