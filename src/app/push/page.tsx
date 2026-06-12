// src/app/push/page.tsx
// Страница /push заменена настройками: push-подписка живёт на /settings
// (слайс src/features/preferences). Старая клиентская реализация
// (use-push-subscription + push-service) удаляется foundation-touch
// батчем волны 1.
import { redirect } from "next/navigation";

export default function PushRedirectPage() {
  redirect("/settings");
}
