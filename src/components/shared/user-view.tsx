// src/components/shared/user-view.tsx
// Единый презентационный вид ссылки на пользователя (автор / владелец / актор) —
// одна точка отображения «кто это» во всём проекте.
//
// Бэк унифицировал модель: owner / actor / editor / created_by / author во всех
// сущностях — это один и тот же `userref.Ref { id?, username? }` (и `comment.Author`
// структурно тот же). UserView принимает ЭТОТ объект целиком, а не разрозненные
// скаляры — фронт-зеркало единой модели.
//
// КОНТРАКТ: ЧИСТЫЙ, без хуков и без i18n. Рендерится в server-, client- И
// изоморфном офлайн-контексте (как comment-node-view) без каких-либо провайдеров.
//
// Фолбэк двухуровневый:
//   1. есть имя        → показываем имя (наследует стиль контекста);
//   2. имени нет, есть id → сырой UUID приглушённо, моноширинно, dir="ltr";
//   3. нет ничего      → «—» (удалённый / системный актор).
//
// Сайт сам решает поведение тем, ЧТО кладёт в объект: передать целиком
// `{ id, username }` → имя-или-UUID; передать `{ username }` (без id) → имя-или-«—».
//
// className намеренно НЕ принимается: смысл компонента — единообразный вид.

/** Минимальная структурная форма ссылки на пользователя — зеркало `userref.Ref`
 *  / `comment.Author`. Локальный тип (не импорт схемы) держит компонент
 *  развязанным от конкретной сущности: подходит owner, actor, author, user.User. */
interface UserRef {
  id?: string | null | undefined;
  username?: string | null | undefined;
}

export function UserView({ user }: { user?: UserRef | null | undefined }) {
  const name = user?.username?.trim();
  if (name) {
    return <span>{name}</span>;
  }
  if (user?.id) {
    return (
      <span dir="ltr" className="font-mono text-(--color-fg-muted)">
        {user.id}
      </span>
    );
  }
  return <span>—</span>;
}
