// src/i18n/messages/ru/banners.ts
// Строки слайса banners: UI-метки форм, admin-список, toast-действия.
const banners = {
  // --- Метки полей форм (create + edit) ---
  fieldColor: "Цвет фона",
  fieldAudience: "Аудитория",
  fieldAudienceAriaLabel: "Аудитория",
  fieldDismissible: "Пользователь может скрыть баннер",
  fieldStartAt: "Начало показа (UTC)",
  fieldEndAt: "Окончание показа (UTC, необязательно)",
  fieldEventId: "id события (необязательно)",
  fieldBlocks: "Текст баннера",
  eventIdPlaceholder: "UUID события из /admin/events",

  // --- Подсказки ---
  hintEndAt:
    "Уже сохранённое «Окончание показа» очистить нельзя — бекенд игнорирует пустое значение этого поля.",
  hintEventId: "Чтобы отвязать событие — очистите поле и сохраните.",

  // --- Кнопки / submit ---
  createButton: "Создать",
  saveButton: "Сохранить",
  deleteButton: "Удалить",
  editButton: "Редактировать",

  // --- Статусы ---
  saved: "Сохранено.",

  // --- Forbidden inline (Case 3: banner-edit-form только) ---
  editAction: "изменение баннера",

  // --- Подтверждение удаления ---
  deleteTitle: "Удалить баннер?",
  deleteDescription:
    "Действие необратимо. Баннер исчезнет со всех страниц сайта.",

  // --- Toast-действия (для toastActionError) ---
  deleteAction: "удаление баннера",
  dismissAction: "скрытие баннера",
  dismissFailTitle: "Не удалось скрыть баннер",

  // --- Dismiss кнопка ---
  dismissAriaLabel: "Скрыть баннер",

  // --- admin-row ---
  noText: "Баннер без текста",
  notDismissible: " · нельзя скрыть",
  hasEvent: " · привязан к событию",

  // --- active-banners aria ---
  sectionLabel: "Объявления",

  // --- Аудитория (audience labels) ---
  audienceAll: "Всем",
  audienceAuthenticated: "Авторизованным",
  audienceAdmin: "Администраторам",

  // --- Период показа (formatBannerPeriod) ---
  periodFrom: "с {start}",
  periodFromTo: "с {start} по {end}",

  // --- create-form: forbiddenAction (Case 3) ---
  createAction: "создание баннера",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Не удалось загрузить баннеры",
    loadItemFailed: "Не удалось загрузить баннер",
    loadRevisionsFailed: "Не удалось загрузить ревизии",
    loadRevisionFailed: "Не удалось загрузить ревизию",
  },
};

export default banners;
