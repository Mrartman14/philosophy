// src/i18n/messages/ru/shareLinks.ts
// Строки слайса share-links (UI + api-error-коды).
const shareLinks = {
  // --- типы ресурсов ---
  resourceTypes: {
    lecture: "Лекция",
    document: "Документ",
    trail: "Трейл",
    media: "Медиа",
    form: "Форма",
    canvas: "Канвас",
  },

  // --- copy-button ---
  copyDefault: "Копировать",
  copiedLabel: "Скопировано ✓",
  copiedToast: "Скопировано",
  copyFailTitle: "Не удалось скопировать",
  copyFailDesc: "Выделите ссылку и скопируйте вручную.",

  // --- share-button ---
  shareButtonLabel: "Поделиться",
  shareDialogTitle: "Поделиться: {type}",
  shareDialogDesc: "Ссылка открывает приватный ресурс держателю без входа.",
  expiresAtLabel: "Срок действия (необязательно)",
  createLinkButton: "Создать ссылку",
  linkCreatedToast: "Ссылка создана",

  // --- share-link-list ---
  statusActive: "Активна",
  statusExpired: "Истекла",
  statusRevoked: "Отозвана",
  emptyTitle: "Ссылок нет",
  emptyDesc: "Для этого ресурса ещё не выпущено ни одной ссылки.",
  colStatus: "Статус",
  colLink: "Ссылка",
  colToken: "Токен",
  colCreated: "Создана",
  colExpires: "Истекает",
  colAction: "Действие",
  urlAriaLabel: "URL ссылки",
  revokeButton: "Отозвать",
  revokedToast: "Ссылка отозвана",

  // --- share-lookup-form ---
  resourceTypeLabel: "Тип ресурса",
  resourceIdLabel: "ID ресурса",
  resourceIdPlaceholder: "UUID ресурса",
  showLinksButton: "Показать ссылки",
};

export default shareLinks;
