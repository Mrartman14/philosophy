// src/i18n/messages/ru/auth.ts
// Строки слайса auth: формы входа/регистрации/выхода.
const auth = {
  // --- login-form ---
  login: {
    usernameLabel: "Логин",
    passwordLabel: "Пароль",
    submit: "Войти",
    fallbackError: "Не удалось войти.",
    // Коды ошибок AuthError (бекенд → UI)
    errors: {
      invalid_credentials: "Неверный логин или пароль.",
      account_blocked: "Аккаунт заблокирован.",
      service_unavailable: "Сервис временно недоступен. Попробуйте позже.",
    },
  },

  // --- register-form ---
  register: {
    usernameLabel: "Логин",
    passwordLabel: "Пароль",
    passwordConfirmLabel: "Повторите пароль",
    submit: "Зарегистрироваться",
    fallbackError: "Не удалось зарегистрироваться.",
    // Коды ошибок AuthError (бекенд → UI)
    errors: {
      username_taken: "Это имя пользователя уже занято.",
      invalid_input: "Проверьте правильность заполнения полей.",
      too_many_requests: "Слишком много попыток. Попробуйте позже.",
      service_unavailable: "Сервис временно недоступен. Попробуйте позже.",
    },
  },

  // --- logout-form (per-device) ---
  logout: {
    trigger: "Выйти",
    dialogTitle: "Выйти из аккаунта?",
    dialogDescription:
      "Сохранённые офлайн-материалы будут удалены с этого устройства. После входа их можно скачать заново.",
    confirmLabel: "Выйти и удалить",
  },

  // --- logout-all-form (all devices) ---
  logoutAll: {
    trigger: "Выйти со всех устройств",
    dialogTitle: "Выйти со всех устройств?",
    dialogDescription:
      "Все активные сессии будут завершены на всех устройствах. Сохранённые офлайн-материалы будут удалены с этого устройства.",
    confirmLabel: "Выйти везде",
  },
};

export default auth;
