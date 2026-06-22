// src/i18n/messages/ru/admin.ts
// UI-строки admin-страниц (src/app/admin/**), включая frozen-оболочку
// (layout.tsx, admin-sidebar.tsx) — локализованы координированным foundation-PR.
const admin = {
  // --- shell (layout.tsx + admin-sidebar.tsx) ---
  shellTitle: "Админ-панель",
  shellBackToSite: "← На сайт",
  shellNavAriaLabel: "Навигация админ-панели",

  // --- nav-итемы (admin-sidebar.tsx; ключ берётся из NavItem.labelKey) ---
  nav: {
    lectures: "Лекции",
    glossary: "Глоссарий",
    tags: "Теги",
    events: "События",
    banners: "Баннеры",
    documents: "Документы",
    forms: "Формы",
    trails: "Маршруты",
    shareLinks: "Ссылки",
    comments: "Комментарии",
    annotations: "Аннотации",
    users: "Пользователи",
    push: "Push-уведомления",
    audit: "Аудит",
  },

  // --- страница /admin (dashboard) ---
  dashboardTitle: "Админ-панель",
  dashboardSubtitle: "Управление разделами — через меню слева.",

  // --- forbidden-страница (403) ---
  forbiddenTitle: "403",
  forbiddenDescription: "Доступ к админ-панели запрещён.",

  // --- лекции ---
  lecturesTitle: "Лекции",
  lecturesCreate: "Создать",
  lecturesEmptyTitle: "Лекций пока нет",
  lecturesEmptyDescription: "Создайте первую.",
  lecturesColTitle: "Название",
  lecturesColDate: "Дата",
  lecturesColVisibility: "Видимость",
  lecturesColActions: "Действия",

  // --- новая лекция ---
  newLectureTitle: "Новая лекция",

  // --- редактирование лекции ---
  editLectureTagsHeading: "Теги",
  editLectureAttachmentsHeading: "Прикрепления",
  editLectureAttachmentsLink: "Управление документами и медиа лекции →",

  // --- прикрепления лекции ---
  attachmentsPageTitle: "{lectureTitle}: прикрепления",
  attachmentsDocumentFallback: "Документ",
  attachmentsDocsSectionTitle: "Документы лекции",
  attachmentsMediaSectionTitle: "Медиа лекции",

  // --- комментарии ---
  commentsTitle: "Модерация комментариев",
  commentsLectureIdLabel: "ID лекции",
  commentsLectureIdPlaceholder: "UUID лекции",
  commentsShowButton: "Показать",
  commentsNoLectureHint: "Укажите ID лекции — глобального списка комментариев на бекенде нет.",
  commentsTotal: "Всего: {total}",
  commentsEmpty: "Комментариев нет.",

  // --- аннотации ---
  annotationsTitle: "Аннотации (публичные)",
  annotationsDescription: "Видны только публичные аннотации. Удаление доступно для публичных (приватные модерации недоступны).",
  annotationsEmpty: "Ничего не найдено.",

  // --- медиа (модерация) ---
  mediaTitle: "Модерация медиа",
  mediaDescription: "Неприватные медиа всех пользователей. Удаление необратимо.",
  mediaEmpty: "Ничего не найдено.",
  mediaTotal: "Всего: {total}",
  mediaOwnerLabel: "Автор",
  mediaFilterOwnerLabel: "ID автора",
  mediaFilterApply: "Показать",
  mediaFilterClear: "Сбросить",

  // --- пользователи ---
  usersTitle: "Пользователи",
  usersTotal: "Всего: {total}",

  // --- теги ---
  tagsTitle: "Теги",
  tagsTotal: "Всего: {total}",
  tagsEmptyTitle: "Тегов пока нет",
  tagsEmptyDescription: "Создайте первый тег формой выше.",

  // --- маршруты ---
  trailsTitle: "Маршруты",
  trailsTotal: "Публичные маршруты. Всего: {total}",

  // --- события ---
  eventsTitle: "События",
  eventsTotal: "Всего: {total}",

  // --- баннеры ---
  bannersTitle: "Баннеры",
  bannersTotal: "Всего: {total}",
  bannerFallbackTitle: "Баннер",

  // --- глоссарий ---
  glossaryTitle: "Глоссарий",
  glossaryTotal: "Всего: {total}",
  glossaryEditHint: "Название термина нельзя изменить. Можно редактировать только тело.",

  // --- документы ---
  documentsTitle: "Документы",
  documentsTotal: "Публичные документы. Всего: {total}",

  // --- формы ---
  formsTitle: "Формы",
  formsTotal: "Публичные формы. Всего: {total}",

  // --- share-ссылки ---
  shareLinksTitle: "Модерация ссылок",
  shareLinksDescription: "Просмотр и отзыв любых share-ссылок. Укажите тип ресурса и его ID.",
  shareLinksHint: "Укажите тип и ID ресурса выше.",

  // --- push ---
  pushTitle: "Push-уведомления",
  pushDescription: "Рассылка уходит всем подписанным пользователям. Отправка асинхронная — доставка занимает время.",

  // --- SEO-мета: <title> страниц ---
  dashboardMetaTitle: "Админ-панель",
  trailsMetaTitle: "Маршруты — админ",
  commentsMetaTitle: "Модерация комментариев",
  formsMetaTitle: "Формы — админ",
  shareLinksMetaTitle: "Модерация ссылок — админ",
  bannersMetaTitle: "Баннеры — админ",
  bannerEditMetaTitle: "Баннеры — редактирование",
  tagsMetaTitle: "Теги — админ",
  annotationsMetaTitle: "Аннотации — модерация",
  mediaMetaTitle: "Медиа — модерация",
  pushMetaTitle: "Push-уведомления — админ",
  auditMetaTitle: "Аудит — админ",
  usersMetaTitle: "Пользователи — админ",
  glossaryMetaTitle: "Глоссарий — админ",
  glossaryEditMetaTitle: "Глоссарий — редактирование термина",
  documentsMetaTitle: "Документы — админ",
  lecturesMetaTitle: "Лекции — админ",
  newLectureMetaTitle: "Новая лекция",
  editLectureMetaTitle: "Редактирование лекции",
  attachmentsMetaTitle: "Прикрепления лекции",
  eventsMetaTitle: "События — админ",
  eventEditMetaTitle: "События — редактирование",
};

export default admin;
