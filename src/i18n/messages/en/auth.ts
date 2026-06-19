// src/i18n/messages/en/auth.ts
// Mirror of ru/auth.ts (English literals). Key parity enforced by satisfies Messages.
const auth = {
  // --- login-form ---
  login: {
    usernameLabel: "Username",
    passwordLabel: "Password",
    submit: "Sign in",
    fallbackError: "Failed to sign in.",
    // AuthError codes (backend → UI)
    errors: {
      invalid_credentials: "Incorrect username or password.",
      account_blocked: "Account is blocked.",
      service_unavailable: "Service temporarily unavailable. Please try again later.",
    },
  },

  // --- register-form ---
  register: {
    usernameLabel: "Username",
    passwordLabel: "Password",
    passwordConfirmLabel: "Repeat password",
    submit: "Create account",
    fallbackError: "Failed to create account.",
    // AuthError codes (backend → UI)
    errors: {
      username_taken: "This username is already taken.",
      invalid_input: "Please check that all fields are filled in correctly.",
      too_many_requests: "Too many attempts. Please try again later.",
      service_unavailable: "Service temporarily unavailable. Please try again later.",
    },
  },

  // --- logout-form (per-device) ---
  logout: {
    trigger: "Sign out",
    dialogTitle: "Sign out of account?",
    dialogDescription:
      "Saved offline materials will be removed from this device. You can download them again after signing in.",
    confirmLabel: "Sign out and delete",
  },

  // --- logout-all-form (all devices) ---
  logoutAll: {
    trigger: "Sign out of all devices",
    dialogTitle: "Sign out of all devices?",
    dialogDescription:
      "All active sessions will be terminated on all devices. Saved offline materials will be removed from this device.",
    confirmLabel: "Sign out everywhere",
  },
};

export default auth;
