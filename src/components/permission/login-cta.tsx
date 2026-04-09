import Link from "next/link";

interface LoginCtaProps {
  /** Текст CTA. По умолчанию — нейтральный. */
  message?: string;
  /** Куда вернуть пользователя после логина (без origin, с лидирующим `/`). */
  redirectTo?: string;
}

/**
 * Inline-блок «Войдите, чтобы …». Заменяет форму / контрол для гостя.
 * Подставляет `?next=` в ссылку на /login, чтобы после логина вернуть
 * пользователя обратно (см. также Task 22, `?next=` в auth-actions).
 */
export const LoginCta: React.FC<LoginCtaProps> = ({
  message = "Войдите, чтобы продолжить",
  redirectTo,
}) => {
  const href = redirectTo
    ? `/login?next=${encodeURIComponent(redirectTo)}`
    : "/login";

  return (
    <p className="text-sm text-(--color-description)">
      {message}.{" "}
      <Link
        href={href}
        className="text-(--color-primary) hover:underline"
      >
        Войти
      </Link>
    </p>
  );
};
