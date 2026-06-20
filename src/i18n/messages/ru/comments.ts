// src/i18n/messages/ru/comments.ts
// Все UI-строки слайса comments. Изоморфные компоненты (comment-node-view,
// comment-tree-view, comment-type-badge, reactions.ts) держат статические
// русские литералы в коде как fallback; строки здесь — для онлайн-контекстов.
const comments = {
  // --- comment-type-badge (catalog only — isomorphic boundary) ---
  type: {
    claim: "Тезис",
    grounds: "Основание",
    rebuttal: "Возражение",
    qualifier: "Уточнение",
    question: "Вопрос",
    answer: "Ответ",
    offtop: "Оффтоп",
    summary: "Итог",
  },

  // --- comment-node-view (isomorphic — optional props, defaults = these values) ---
  deleted: "Комментарий удалён",
  edited: "(изменён)",

  // --- comment-tree-view / comment-tree (isomorphic) ---
  empty: "Комментариев пока нет.",

  // --- comment-section ---
  sectionLabel: "Комментарии",
  sectionHeading: "Обсуждение",
  loginPrompt: "Войдите, чтобы оставить комментарий.",
  unavailable: "Комментарии временно недоступны.",
  searchFoundCount: "Найдено: {count}",
  noSnippet: "(без текста)",

  // --- comment-anchor-context ---
  anchor: {
    boundTo: "Привязка к {entity}",
    document: "документу",
    glossary: "термину",
    comment: "комментарию",
    media: "медиа",
  },

  // --- comment-search ---
  searchPlaceholder: "Поиск по комментариям…",
  searchAriaLabel: "Поиск по комментариям лекции",
  searchButton: "Найти",
  searchPending: "…",

  // --- comment-create-form ---
  createTypeLabel: "Тип комментария",
  createTypeAriaLabel: "Тип комментария",
  createBodyLabel: "Текст",
  createBodyAriaLabel: "Текст комментария",
  createSuccess: "Комментарий добавлен.",
  createSubmit: "Отправить",
  createForbiddenAction: "создание комментария",

  // --- comment-edit-form ---
  editButton: "Редактировать",
  editBodyLabel: "Текст",
  editBodyAriaLabel: "Редактирование комментария",
  editSuccess: "Сохранено.",
  editSubmit: "Сохранить",
  editCancel: "Отмена",
  editForbiddenAction: "изменение комментария",

  // --- comment-reply-form ---
  replyButton: "Ответить",
  replyTypeLabel: "Тип ответа",
  replyTypeAriaLabel: "Тип ответа",
  replyBodyLabel: "Текст ответа",
  replyBodyAriaLabel: "Текст ответа",
  replySubmit: "Ответить",
  replyCancel: "Отмена",
  replyForbiddenAction: "ответ",

  // --- comment-delete-button ---
  deleteButton: "Удалить",
  deleteDone: "Удалено",
  deleteDialogTitle: "Удалить комментарий?",
  deleteDialogDescription:
    "Действие необратимо. Если у комментария есть ответы, он станет «удалён», но ветка сохранится.",
  deleteDialogConfirm: "Удалить",
  deleteForbiddenTitle: "Не удалось удалить",
  deleteFailureTitle: "Не удалось удалить",
  deleteAction: "удаление комментария",

  // --- comment-reactions (forbidden error) ---
  reactionForbidden: "У вас нет прав на реакцию.",

  // --- lazy-ast-editor ---
  editorLoading: "Загрузка редактора…",

  // --- admin-comment-row ---
  adminDeleted: "удалён",

  // --- reactions.ts axis labels (catalog only — isomorphic boundary) ---
  axis: {
    agreement: "Согласие",
    quality: "Качество",
    insight: "Инсайт",
  },
  axisValueAria: {
    agreementPos: "согласен",
    agreementNeg: "не согласен",
    qualityPos: "высокое качество",
    qualityNeg: "низкое качество",
    insightMark: "отметить как инсайт",
  },

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadSchemaFailed: "Не удалось загрузить схему комментариев",
    loadListFailed: "Не удалось загрузить комментарии",
    loadSubtreeFailed: "Не удалось загрузить ветку",
    searchFailed: "Не удалось выполнить поиск",
    loadRevisionsFailed: "Не удалось загрузить ревизии",
    loadRevisionFailed: "Не удалось загрузить ревизию",
    loadBlockFailed: "Не удалось загрузить блок",
  },
};

export default comments;
