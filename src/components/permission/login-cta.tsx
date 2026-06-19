import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

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
export const LoginCta: React.FC<LoginCtaProps> = async ({
  message,
  redirectTo,
}) => {
  const t = await getT("common");
  const resolvedMessage = message ?? t("loginCta.loginToContinue");
  const href = redirectTo
    ? `/login?next=${encodeURIComponent(redirectTo)}`
    : "/login";

  return (
    <p className="text-sm text-(--color-fg-muted)">
      {resolvedMessage}.{" "}
      <RouterLink
        href={href}
        className="text-(--color-accent) hover:underline"
      >
        {t("loginCta.loginButton")}
      </RouterLink>
    </p>
  );
};
