"use client";

import { useReportBoundaryError } from "@/services/observability/use-report-boundary-error";

// Этот компонент заменяет root layout целиком (Next.js global-error),
// поэтому I18nProvider недоступен. useT/getT нельзя.
// Единственное санкционированное исключение: мини client-резолв локали.

const MESSAGES = {
  ru: {
    title: "Что-то пошло не так",
    description: "Произошла критическая ошибка. Попробуйте обновить страницу.",
    retry: "Повторить",
  },
  en: {
    title: "Something went wrong",
    description: "A critical error occurred. Try refreshing the page.",
    retry: "Retry",
  },
} as const;

type Lang = keyof typeof MESSAGES;

function resolveLocale(): Lang {
  if (typeof document === "undefined") return "ru";
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("locale="));
  if (!match) return "ru";
  const value = match.slice("locale=".length).trim();
  if (value === "en") return "en";
  // "system" или любое другое значение → "ru"
  return "ru";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportBoundaryError(error);
  const lang = resolveLocale();
  const m = MESSAGES[lang];
  return (
    <html lang={lang}>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            {m.title}
          </h1>
          <p style={{ margin: 0, color: "#6b7280" }}>
            {m.description}
          </p>
          {/* eslint-disable-next-line no-restricted-syntax -- критический root error-boundary: inline-style ради надёжности при несработавшем CSS, kit-Button недоступен (нет провайдеров) */}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            {m.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
