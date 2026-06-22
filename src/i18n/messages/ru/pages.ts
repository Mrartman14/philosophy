// src/i18n/messages/ru/pages.ts
// Захардкоженные UI-строки публичных страниц (src/app/** кроме admin/).
const pages = {
  // ─── Глобальные ошибки / not-found / offline ─────────────────────────
  errorTitle: "Что-то пошло не так",
  errorBody: "Произошла ошибка при загрузке страницы.",
  errorRetry: "Попробовать снова",
  errorCritical: "Произошла критическая ошибка. Попробуйте обновить страницу.",
  errorCriticalRetry: "Повторить",
  notFoundTitle: "Страница не найдена",
  notFoundHome: "На главную",
  offlineTitle: "Нет сети",
  offlineHint: "Проверьте подключение к интернету и попробуйте снова.",

  // ─── Главная страница ─────────────────────────────────────────────────
  homeTitle: "Философия-ликбез",
  homeComingSoon: "Контент готовится. Вернитесь позже.",

  // ─── Авторизация (login / register) ──────────────────────────────────
  loginTitle: "Войти",
  loginHeading: "Войти",
  loginBanned: "Ваш аккаунт заблокирован. Обратитесь в поддержку.",
  loginRegistered: "Регистрация прошла успешно. Войдите с вашим логином и паролем.",
  loginNoAccount: "Нет аккаунта?",
  loginRegisterLink: "Зарегистрируйтесь",
  registerTitle: "Регистрация",
  registerHeading: "Регистрация",
  registerHasAccount: "Уже есть аккаунт?",
  registerLoginLink: "Войдите",

  // ─── /me (личный кабинет) ─────────────────────────────────────────────
  meTitle: "Личный кабинет",
  meHint: "Выберите раздел выше.",

  // ─── /me nav sections ────────────────────────────────────────────────
  meNavNotifications: "Уведомления",
  meNavDocuments: "Мои документы",
  meNavMedia: "Мои медиа",
  meNavAnnotations: "Мои аннотации",
  meNavForms: "Мои формы",
  meNavSubmissions: "Мои отклики",
  meNavStats: "Моя статистика",
  meNavSettings: "Настройки",

  // ─── /me/notifications ───────────────────────────────────────────────
  notificationsTitle: "Уведомления",
  notificationsHeading: "Уведомления",
  notificationsEmpty: "Пока нет уведомлений.",

  // ─── /me/documents ───────────────────────────────────────────────────
  myDocumentsTitle: "Мои документы",
  myDocumentsHeading: "Мои документы",
  myDocumentsTotal: "Всего: {total}",
  myDocumentsCreate: "Создать документ",
  myDocumentsUpload: "Загрузить .md",

  // ─── /me/media ───────────────────────────────────────────────────────
  myMediaTitle: "Мои медиа",
  myMediaHeading: "Мои медиа",
  myMediaUploadSection: "Загрузить",

  // ─── /me/annotations ─────────────────────────────────────────────────
  myAnnotationsTitle: "Мои аннотации",
  myAnnotationsHeading: "Мои аннотации",
  myAnnotationsEmpty: "У вас пока нет аннотаций.",

  // ─── /me/forms ───────────────────────────────────────────────────────
  myFormsTitle: "Мои формы",
  myFormsHeading: "Мои формы",
  myFormsCreate: "Создать форму",

  // ─── /me/submissions ─────────────────────────────────────────────────
  mySubmissionsTitle: "Мои отклики",
  mySubmissionsHeading: "Мои отклики",

  // ─── /me/stats ───────────────────────────────────────────────────────
  myStatsTitle: "Моя статистика",
  myStatsHeading: "Моя статистика",
  myStatsCreated: "Что я создал",
  myStatsViews: "Мои просмотры",

  // ─── /lectures ───────────────────────────────────────────────────────
  lecturesTitle: "Лекции",
  lecturesHeading: "Лекции",
  lecturesLoadingLabel: "Загрузка лекций…",

  // ─── /lectures/[id] ──────────────────────────────────────────────────
  lectureDefaultTitle: "Лекция",

  // ─── /lectures/[id]/annotations ──────────────────────────────────────
  lectureAnnotationsTitle: "Аннотации лекции",
  lectureAnnotationsHeading: "Аннотации лекции",
  lectureAnnotationsEmpty: "К материалам этой лекции пока нет аннотаций.",

  // ─── /glossary ───────────────────────────────────────────────────────
  glossaryTitle: "Глоссарий",
  glossaryHeading: "Глоссарий",
  glossaryLoadingLabel: "Загрузка глоссария…",

  // ─── /glossary/[id] ──────────────────────────────────────────────────
  termDefaultTitle: "Термин",

  // ─── /calendar ───────────────────────────────────────────────────────
  calendarTitle: "Календарь",
  calendarHeading: "Календарь",

  // ─── /search ─────────────────────────────────────────────────────────
  searchTitle: "Поиск",
  searchHeading: "Поиск",
  searchSubtitle: "Семантический поиск по документам и терминам глоссария.",
  searchPlaceholder: "Введите запрос, чтобы начать поиск.",
  searchUnavailable: "Поиск временно недоступен. Попробуйте позже.",

  // ─── /map ────────────────────────────────────────────────────────────
  mapTitle: "Карта смыслов",
  mapLink: "Посмотреть на карте",

  // ─── /graph ──────────────────────────────────────────────────────────
  graphTitle: "Граф связности",

  // ─── /me/tokens ──────────────────────────────────────────────────────
  tokensTitle: "Персональные токены",
  tokensHeading: "Персональные токены доступа",
  tokensSubtitle:
    "Токены для доступа к API от вашего имени — например, для подключения внешнего сервиса со своим LLM.",

  // ─── /share-links ────────────────────────────────────────────────────
  shareLinksTitle: "Мои ссылки",
  shareLinksHeading: "Мои ссылки",
  shareLinksSubtitle: "Управление share-ссылками. Выберите тип ресурса и укажите его ID, чтобы увидеть выпущенные ссылки.",
  shareLinksHint: "Укажите тип и ID ресурса выше.",

  // ─── /canvases ───────────────────────────────────────────────────────
  canvasesTitle: "Канвасы",
  canvasesHeading: "Канвасы",
  canvasesTotal: "Всего: {total}",
  canvasesCreate: "Создать канвас",

  // ─── /canvases/new ───────────────────────────────────────────────────
  canvasNewTitle: "Новый канвас",
  canvasNewHeading: "Новый канвас",

  // ─── /canvases/[id] ──────────────────────────────────────────────────
  canvasDefaultTitle: "Канвас",
  canvasEditSection: "Редактирование",
  canvasOpenEditor: "Открыть редактор",

  // ─── /canvases/[id]/edit ─────────────────────────────────────────────
  canvasEditorTitle: "Редактор канваса",
  canvasEditorHeading: "Редактор канваса {title}",

  // ─── /documents ──────────────────────────────────────────────────────
  documentsLoadingLabel: "Загрузка документов…",

  // ─── /documents/[id] ─────────────────────────────────────────────────
  documentDefaultTitle: "Документ",
  documentEdit: "Редактировать",

  // ─── /documents/[id]/edit ────────────────────────────────────────────
  documentEditHeading: "Редактирование",
  documentEditBack: "К документу",
  documentEditMetaTitleFull: "Редактирование: {filename}",
  documentEditMetaTitleFallback: "Редактирование документа",

  // ─── /trails ─────────────────────────────────────────────────────────
  trailsTitle: "Маршруты",
  trailsHeading: "Маршруты",
  trailsSubtitle: "Курируемые подборки лекций. Всего: {total}",
  trailsLoadingLabel: "Загрузка троп…",

  // ─── /trails/my ──────────────────────────────────────────────────────
  myTrailsTitle: "Мои маршруты",
  myTrailsHeading: "Мои маршруты",
  myTrailsTotal: "Всего: {total}",
  myTrailsCreate: "Создать маршрут",

  // ─── /trails/[id] ────────────────────────────────────────────────────
  trailDefaultTitle: "Маршрут",
  trailEditSection: "Редактирование",

  // ─── /forms/[id] ─────────────────────────────────────────────────────
  formDefaultTitle: "Форма",
  formSubmissionsLink: "Отклики",
  formFillSection: "Заполнить",
  formEditSection: "Редактирование структуры",
  formEditHint: "Доступно только до публикации. После публикации структура замораживается.",
  formPublishedNote: "Форма опубликована — её структуру нельзя изменить.",

  // ─── /forms/[id]/submissions ─────────────────────────────────────────
  formSubmissionsTitle: "Отклики формы",
  formSubmissionsHeading: "Отклики: {formTitle}",
  formSubmissionsTotal: "Всего: {total}",

  // ─── /comments/[id] ──────────────────────────────────────────────────
  commentTitle: "Комментарий",
  commentThreadHeading: "Ветка обсуждения",

  // ─── /media/[id] ─────────────────────────────────────────────────────
  mediaDefaultTitle: "Медиа",

  // ─── /submissions/[id] ───────────────────────────────────────────────
  submissionTitle: "Отклик",
  submissionRetracted: "Отклик отозван",
  submissionSent: "Отправлен {date}",
  submissionYourResponse: "Ваш отклик",
  submissionContents: "Содержимое отклика",

  // ─── /saved ──────────────────────────────────────────────────────────
  savedTitle: "Сохранённое офлайн",
  savedListHeading: "Сохранённое офлайн",
  savedListEmpty: "Пока ничего не сохранено. Откройте лекцию и нажмите «Сохранить офлайн».",

  // ─── /saved/[id] (SavedLectureView) ──────────────────────────────────
  savedLectureMissing: "Эта лекция не сохранена офлайн.",
  savedLectureSaving: "Лекция ещё сохраняется…",
  savedLectureIncomplete: "Сохранение не завершено: {error}.",
  savedLectureCorrupt: "Сохранённый снимок повреждён или устарел — откройте лекцию онлайн и сохраните заново.",
  savedLectureGone: "Эта лекция удалена с платформы. У вас осталась сохранённая копия.",
  savedLectureStale: "Доступна обновлённая версия — нажмите «Обновить».",
  savedLectureSavedAt: "Сохранено офлайн:",
  savedLectureRefreshing: "Обновление…",
  savedLectureRefresh: "Обновить",
  savedLectureRefreshError: "Не удалось обновить — проверьте подключение.",
  savedLectureComments: "Комментарии",
  savedLectureSavedBadge: "Сохранено офлайн ✓",

  // ─── _offline/save-offline-button ────────────────────────────────────
  saveOfflineSaving: "Сохранение…",
  saveOfflineButton: "Сохранить офлайн",
  saveOfflineSuccessTitle: "Сохранено для офлайна",
  saveOfflineFailTitle: "Не удалось сохранить офлайн",
  saveOfflineUpdateAvailable: "Доступно обновление",
  saveOfflineUpdate: "Обновить",
  saveOfflineUpdating: "Обновление…",
  saveOfflineRemove: "Удалить копию",
  saveOfflineRemoving: "Удаление…",
  saveOfflineRemoveConfirmTitle: "Удалить офлайн-копию?",
  saveOfflineRemoveConfirmBody:
    "Копия будет удалена с устройства. Восстановить её можно только онлайн — сохранив лекцию заново.",
  saveOfflineRemoveConfirmAction: "Удалить",
  saveOfflineRemovedToast: "Офлайн-копия удалена",
  saveOfflineRemoveFailTitle: "Не удалось удалить копию",

  // ─── saved-list stale sweep ──────────────────────────────────────────
  savedListStaleSaving: "Сохранение прервано — откройте лекцию и сохраните заново.",
};

export default pages;
