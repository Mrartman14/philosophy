// src/i18n/messages/ru/forms.ts
// Строки слайса forms: конструктор, заполнение, управление откликами.
const forms = {
  // --- field-kinds: метки типов полей ---
  fieldType: {
    text: "Короткий текст",
    long_text: "Длинный текст",
    single_choice: "Один из вариантов",
    multi_choice: "Несколько вариантов",
    number: "Число",
    date: "Дата",
  },

  // --- form-meta: метки статусов ---
  visibility: {
    private: "Приватная",
    public: "Публичная",
    // *Lower — строчный вариант для интерполяции в середине предложения
    // (my-forms-list: «Видимость: {privateLower}»). Намеренная конвенция.
    privateLower: "приватная",
    publicLower: "публичная",
  },
  submissionMode: {
    editable: "Отклик можно менять и удалять",
    immutable: "Отклик можно только отозвать",
    // *Lower — строчный вариант для интерполяции в середине предложения
    // (my-forms-list: «Режим: {editableLower}»). Намеренная конвенция.
    editableLower: "редактируемый",
    immutableLower: "без изменений",
  },
  publishedBadge: "Опубликована",
  publishedSuffix: " · опубликована",
  draftSuffix: " · черновик",

  // --- form-detail: заголовок-фолбэк ---
  untitled: "Форма",
  untitledForm: "Без названия",

  // --- form-after-submit ---
  afterSubmitTitle: "После отправки",

  // --- form-builder ---
  builder: {
    titleLabel: "Название формы",
    descriptionLabel: "Описание (markdown, необязательно)",
    afterSubmitLabel: "Текст после отправки (markdown, необязательно)",
    visibilityLabel: "Видимость",
    visibilityPrivate: "Приватная",
    visibilityPublic: "Публичная (опубликовать сразу)",
    submissionModeLabel: "Режим откликов",
    submissionModeEditable: "Редактируемый (можно менять/удалять отклик)",
    submissionModeImmutable: "Без изменений (только отозвать)",
    submissionModeHint:
      "Режим «без изменений» нельзя будет смягчить позже. Публичную форму нельзя вернуть в приватную, а её структуру — менять.",
    addField: "+ Добавить поле",
    submissionVisibilityLabel: "Видимость результатов",
    submissionVisibilityPrivate: "Приватные (видит только владелец)",
    submissionVisibilityPublic: "Публичные (атрибутированные голоса видны периметру)",
    submissionVisibilityHint: "После создания изменить нельзя.",
  },

  // --- form-results ---
  results: {
    totalSubmissions:
      "{n, plural, one {# отклик} few {# отклика} many {# откликов} other {# отклика}}",
    answered:
      "{n, plural, one {# ответил} few {# ответили} many {# ответили} other {# ответили}}",
    multiHint: "возможно несколько вариантов",
    min: "мин",
    max: "макс",
    avg: "сред",
    sum: "сумма",
    empty: "Пока нет откликов",
    noTextAnswers: "Нет ответов",
    allAnswers: "Все ответы →",
    forbidden: "Результаты этой формы закрыты",
    titleSuffix: "Результаты",
    prevPage: "← Назад",
    nextPage: "Вперёд →",
    fieldType: {
      text: "текст",
      long_text: "текст",
      single_choice: "одиночный выбор",
      multi_choice: "множественный выбор",
      number: "число",
      date: "дата",
    },
  },

  // --- form/result/mode badges ---
  badges: {
    form: { private: "Форма: приватная", public: "Форма: публичная" },
    results: { private: "Результаты: приватные", public: "Результаты: публичные" },
    mode: { editable: "Режим: редактируемый", immutable: "Режим: фиксированный" },
  },

  // --- form-fill: согласие на публичный голос ---
  publicVoteConsent:
    "Это публичный опрос: твой ответ будет виден всем, кто видит эту форму, с указанием авторства.",

  // --- form-builder-field-row ---
  fieldRow: {
    heading: "Поле #{index}",
    ariaUp: "Вверх",
    ariaDown: "Вниз",
    ariaRemove: "Удалить",
    typeLabel: "Тип поля",
    promptLabel: "Текст вопроса (markdown)",
    helpLabel: "Подсказка (необязательно, markdown)",
    requiredLabel: "Обязательное поле",
    optionsLabel: "Варианты",
    optionPlaceholder: "Вариант {index}",
    ariaRemoveOption: "Удалить вариант",
    addOption: "+ Вариант",
  },

  // --- form-create-form / form-edit-form: кнопки ---
  createSubmit: "Создать форму",
  editSubmit: "Сохранить структуру",

  // --- form-delete-button / form-admin-row ---
  deleteFormLabel: "Удалить форму",
  deleteFormTitle: "Удалить форму?",
  deleteFormDescriptionAdmin: "Удаляется публичная форма вместе со всеми откликами. Действие необратимо.",
  deleteFormDescription: "Действие необратимо. Будут удалены все отклики на форму.",
  deleteConfirm: "Удалить",

  // --- form-publish-button ---
  publishButton: "Опубликовать",
  publishTitle: "Опубликовать форму?",
  publishDescription:
    "После публикации форму нельзя вернуть в приватную, а её структуру — изменить. Действующие share-ссылки перестанут работать.",
  publishConfirm: "Опубликовать",

  // --- form-fill ---
  submitSuccessMessage: "Ответ отправлен. Спасибо!",
  requiredFieldsTitle: "Заполните обязательные поля",
  requiredFieldsDescription: "Не все обязательные поля заполнены.",
  submitButton: "Отправить отклик",
  submittingButton: "Отправка…",

  // --- submission-actions ---
  deleteSubmissionButton: "Удалить отклик",
  retractSubmissionButton: "Отозвать отклик",
  deleteSubmissionTitle: "Удалить отклик?",
  retractSubmissionTitle: "Отозвать отклик?",
  deleteSubmissionDescription: "Отклик будет удалён. Вы сможете заполнить форму заново.",
  retractSubmissionDescription: "Отзыв необратим: повторно отправить отклик на эту форму будет нельзя.",
  deleteSubmissionConfirm: "Удалить",
  retractSubmissionConfirm: "Отозвать",

  // --- submission-detail ---
  submissionRetracted: "Отклик отозван — ответы удалены.",

  // --- submission-edit-form ---
  saveButton: "Сохранить изменения",
  savingButton: "Сохранение…",

  // --- my-forms-list ---
  noForms: "У вас пока нет форм.",

  // --- my-submissions-list ---
  noSubmissions: "У вас пока нет откликов.",
  submissionRetractedLabel: "отозван",
  formLinkPrefix: "Форма {id}",

  // --- submission-list ---
  noSubmissionsAdmin: "Откликов пока нет.",
  submissionLinkPrefix: "Отклик {id}",

  // --- toastActionError actions (родительный падеж для errors.forbiddenAction) ---
  fillAction: "отправку отклика",
  submissionEditAction: "изменение отклика",
  publishAction: "публикацию формы",
  deleteFormAction: "удаление формы",
  deleteSubmissionAction: "удаление отклика",
  retractSubmissionAction: "отзыв отклика",

  // --- toastActionError failureTitle переопределения ---
  fillFailureTitle: "Не удалось отправить",
  submissionEditFailureTitle: "Не удалось сохранить",

  // --- forbiddenAction per-feature действия (для FormFeedback.forbiddenAction) ---
  editFormForbiddenAction: "изменение формы",
  createFormForbiddenAction: "создание формы",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadItemFailed: "Не удалось загрузить форму",
    loadMyFailed: "Не удалось загрузить формы",
    loadMySubmissionsFailed: "Не удалось загрузить отклики",
    loadSubmissionsFailed: "Не удалось загрузить отклики",
    loadSubmissionFailed: "Не удалось загрузить отклик",
    loadAdminFailed: "Не удалось загрузить формы",
    loadStatsFailed: "Не удалось загрузить статистику формы",
    loadFieldAnswersFailed: "Не удалось загрузить ответы на поле",
  },
};

export default forms;
