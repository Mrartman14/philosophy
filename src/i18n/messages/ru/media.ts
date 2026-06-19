// src/i18n/messages/ru/media.ts
// Namespace для слайса media: UI-строки карточек, форм, диалогов подтверждения.
const media = {
  // --- тип и статус ---
  typeVideo: "Видео",
  typeAudio: "Аудио",
  statusPublic: "Опубликовано",
  statusPrivate: "Приватно",

  // --- пустые состояния / информационные ---
  emptyTitle: "Пока нет медиа",
  emptyDescription: "Загрузите видео или аудио — оно появится здесь.",
  unavailable: "Файл недоступен для воспроизведения.",
  videoBrowserFallback: "Ваш браузер не поддерживает воспроизведение видео.",
  audioBrowserFallback: "Ваш браузер не поддерживает воспроизведение аудио.",

  // --- раздел лекций на странице медиа ---
  lecturesSection: "Лекции",
  noContainers: "Медиа не прикреплено ни к одной лекции.",
  lectureLink: "Лекция {id}…",

  // --- удаление ---
  deleteButton: "Удалить",
  deleteTitle: "Удалить медиа?",
  deleteDescription: "Действие необратимо. Файл будет удалён, ссылки на него перестанут работать.",
  deleteDescriptionAdmin: "Удаление администратором. Действие необратимо: файл будет удалён, ссылки на него перестанут работать.",
  deleteAction: "удаление медиа",

  // --- публикация ---
  publishButton: "Опубликовать",
  publishTitle: "Опубликовать медиа?",
  publishDescription:
    "После публикации медиа станет публичным. Откатить обратно в приватное нельзя — только удалить.",
  publishedToast: "Опубликовано",
  publishAction: "публикацию медиа",

  // --- форма загрузки ---
  uploadTypeLabel: "Тип",
  uploadVideoOption: "Видео (mp4, webm)",
  uploadAudioOption: "Аудио (mp3, m4a, ogg)",
  uploadFileLabel: "Файл",
  uploadBusy: "Загрузка…",
  uploadSubmit: "Загрузить",
  uploadHint: "Новое медиа создаётся приватным. Опубликовать можно на его странице.",
  uploadToastNoFile: "Выберите файл",
  uploadErrorTitle: "Ошибка загрузки",
  uploadSuccessTitle: "Загружено",
  uploadAction: "загрузку медиа",
  uploadFileTooLarge: "Файл слишком большой (макс 100 MB).",
  uploadInvalidFormat: "Неподдерживаемый формат. Видео: mp4/webm. Аудио: mp3/m4a/ogg.",
  uploadSelectType: "Выберите тип: видео или аудио.",
};

export default media;
