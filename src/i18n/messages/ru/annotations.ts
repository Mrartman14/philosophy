// src/i18n/messages/ru/annotations.ts
// UI-строки слайса annotations.
const annotations = {
  // --- annotation-card ---
  visibility: {
    private: "приватная",
    public: "публичная",
    unknown: "приватная",
  },
  edited: " · изменена",

  // --- annotation-list ---
  empty: "Аннотаций пока нет.",

  // --- annotation-create-form ---
  createBodyLabel: "Текст аннотации",
  createBodyAriaLabel: "Текст аннотации",
  createSubmit: "Добавить аннотацию",
  createForbiddenAction: "создание аннотации",

  // --- annotation-edit-form ---
  editBodyLabel: "Текст аннотации",
  editBodyAriaLabel: "Текст аннотации",
  editSuccess: "Сохранено.",
  editForbiddenAction: "изменение аннотации",
  editSubmit: "Сохранить",

  // --- annotation-edit-button ---
  editButton: "Редактировать",
  editDialogTitle: "Редактировать аннотацию",
  editorLoading: "Загрузка редактора…",

  // --- annotation-delete-button ---
  deleteButton: "Удалить",
  deleteDialogTitle: "Удалить аннотацию?",
  deleteDialogDescription: "Действие необратимо.",
  deleteDialogConfirm: "Удалить",
  deleteAction: "удаление аннотации",

  // --- annotation-visibility-field ---
  visibilityLegend: "Видимость",
  visibilityPrivateLabel: "Приватная (видна только мне)",
  visibilityPublicLabel: "Публичная (видна всем, кто видит сущность)",
  visibilityImmutableNote: "Видимость нельзя изменить после создания.",

  // --- annotation-admin-filter-form ---
  filterEntityTypeLabel: "Тип сущности:",
  filterEntityTypeAll: "Все",

  // --- annotations-section ---
  sectionLabel: "Аннотации",
  sectionHeading: "Аннотации",

  // --- annotation-admin-row ---
  adminAuthorLabel: "автор",

  // --- actions.ts: internal error when annotation not found ---
  notFound: "Аннотация не найдена.",

  // --- marginalia engine (composer / connector) ---
  marginAddButton: "Аннотация",
  marginAddUnanchored: "Добавить аннотацию",
  marginComposerTitle: "Новая аннотация",
  marginOrphanLabel: "Фрагмент не найден",
  marginHighlightToggleOn: "Скрыть подсветку",
  marginHighlightToggleOff: "Показать подсветку",
  marginColumnLabel: "Аннотации на полях",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Не удалось загрузить аннотации",
    loadListFailedStatus: "Не удалось загрузить аннотации ({status})",
    loadItemFailed: "Не удалось загрузить аннотацию",
    loadMyFailed: "Не удалось загрузить мои аннотации",
    loadLectureFailed: "Не удалось загрузить аннотации лекции",
    loadAdminFailed: "Не удалось загрузить список аннотаций",
    loadRevisionsFailed: "Не удалось загрузить ревизии",
    loadRevisionFailed: "Не удалось загрузить ревизию",
  },
};

export default annotations;
