// src/i18n/messages/ru/preferences.ts
// Per-feature namespace для слайса preferences.
const preferences = {
  // --- preferences-form ---
  readingModeLabel: "Режим чтения",
  readingModeDescription:
    "«Фокусированный» скрывает второстепенные элементы на странице лекции.",
  readingModeAriaLabel: "Режим чтения",
  readingModeFull: "Полный",
  readingModeFocused: "Фокусированный",
  settingsSaved: "Настройки сохранены.",
  saveButton: "Сохранить",
  // Action для «У вас нет прав на {action}.» (Case 3)
  updateSettingsAction: "изменение настроек",

  // --- comment-reply-notify-toggle ---
  commentReplyNotifyLabel: "Уведомлять об ответах на мои комментарии",
  commentReplyNotifyDescription:
    "Когда кто-то отвечает на ваш комментарий, вы получаете уведомление.",
  commentReplyNotifySaved: "Настройка сохранена.",

  // --- push-send-form ---
  pushTitleLabel: "Заголовок",
  pushBodyLabel: "Текст",
  pushUrlLabel: "Ссылка",
  pushUrlDescription:
    "Откроется по клику на уведомление. Путь («/lectures/…») или полный http(s)-URL.",
  pushTitlePlaceholder: "Например: «Новая лекция»",
  pushSendAccepted: "Рассылка принята и будет доставлена подписчикам в фоне.",
  pushSendButton: "Отправить",
  // Action для «У вас нет прав на {action}.» (Case 3)
  pushSendAction: "отправку push-уведомлений",

  // --- push-subscription-toggle ---
  pushCheckingSubscription: "Проверяем подписку…",
  pushUnsupported: "Push-уведомления не поддерживаются в этом браузере.",
  pushDenied: "Уведомления заблокированы. Разрешите их в настройках браузера.",
  pushUnavailable: "Push-уведомления временно недоступны.",
  pushSubscribed: "Вы подписаны на уведомления.",
  pushNotSubscribed: "Вы не подписаны на уведомления.",
  pushUnsubscribeButton: "Отписаться",
  pushSubscribeButton: "Подписаться",
  pushNoPermission: "У вас нет прав на подписку на уведомления.",
  pushSubscribeError: "Не удалось оформить подписку. Попробуйте ещё раз.",
  pushUnsubscribeError: "Не удалось отписаться. Попробуйте ещё раз.",
  // Action для «У вас нет прав на {action}.» (Case 3)
  pushSubscribeAction: "подписку на уведомления",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadFailed: "Не удалось загрузить настройки",
  },
};

export default preferences;
