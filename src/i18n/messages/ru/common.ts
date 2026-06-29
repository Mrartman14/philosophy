// src/i18n/messages/ru/common.ts
// Общие UI-строки: навигация, статусы, шаблоны компонентов.
const common = {
  // Навигация (app-header, app-nav)
  nav: {
    lectures: "Лекции",
    calendar: "Календарь",
    trails: "Маршруты",
    canvases: "Канвасы",
    login: "Войти",
  },

  // install-banner
  installBanner: {
    installApp: "Установить приложение на устройство",
    install: "Установить",
    iosHint: "Нажмите «Поделиться» ⎋ → «На экран Домой» + чтобы установить",
  },

  // network-indicator
  networkIndicator: {
    offline: "Нет сети",
  },

  // update-prompt
  updatePrompt: {
    updateAvailable: "Доступно обновление",
    update: "Обновить",
  },

  // shared/go-back
  back: "Назад",

  // UI-kit: pagination (рендерится в server-компонентах — резолвится через getT
  // на стороне caller и пробрасывается пропом labels)
  pagination: {
    ariaLabel: "Пагинация",
    prev: "Назад",
    next: "Вперёд",
    range: "{from}–{to} из {total}",
    rangeEmpty: "0 из 0",
  },

  // UI-kit: confirm-dialog (client)
  confirmDialog: {
    confirm: "Подтвердить",
    cancel: "Отмена",
  },

  // UI-kit: select (client)
  select: {
    placeholder: "Выберите…",
  },

  // UI-kit: form-field (client) — локализация нативного браузерного сообщения
  // валидации `required` (valueMissing). Без неё Base UI показывает
  // `element.validationMessage`, локализованное по языку БРАУЗЕРА, а не UI-локали.
  field: {
    required: "Заполните это поле",
    invalid: "Введите корректное значение",
  },

  // UI-kit: clampable-content (client)
  clampable: {
    expand: "Показать полностью",
    collapse: "Свернуть",
  },

  // permission/status-banner
  statusBanner: {
    suspended: "Ваш аккаунт временно ограничен. Чтение доступно, новые действия — нет.",
  },

  // canvas-render
  canvasRender: {
    emptyGraph: "Граф пуст.",
    graphAriaLabel: "Граф канваса",
  },

  // revision-history
  revisionHistory: {
    title: "История ревизий",
    empty: "Ревизий пока нет.",
  },

  // attachments
  attachments: {
    title: "Прикрепления",
    empty: "Пока ничего не прикреплено.",
    operationError: "Ошибка операции",
    attach: "Прикрепить",
    canvasNoPreview: "(canvas — просмотр недоступен)",
    moveUp: "Выше",
    moveDown: "Ниже",
    detach: "Открепить",
    search: "Поиск…",
  },
};

export default common;
