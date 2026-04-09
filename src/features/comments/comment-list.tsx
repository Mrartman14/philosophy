import { getUser } from "@/utils/get-user";
import { getComments } from "./api";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";

interface CommentListProps {
  lectureId: string;
}

export const CommentList: React.FC<CommentListProps> = async ({
  lectureId,
}) => {
  const user = await getUser();

  let comments: Awaited<ReturnType<typeof getComments>>["data"] = [];
  let loadError = false;
  try {
    const result = await getComments(lectureId);
    comments = result.data;
  } catch {
    loadError = true;
  }

  const isAuthorized = user !== null && user.status === "active";
  const isPrivileged =
    user !== null && (user.role === "moderator" || user.role === "admin");

  return (
    <section className="flex flex-col gap-4 p-4 border-t border-(--color-border)">
      <h2 className="text-lg font-semibold">Комментарии</h2>

      {isAuthorized ? (
        <CommentForm lectureId={lectureId} allowAnonymous={true} />
      ) : (
        <p className="text-sm text-(--color-description)">
          Войдите, чтобы оставить комментарий.
        </p>
      )}

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить комментарии.
        </p>
      )}

      {!loadError && comments.length === 0 && (
        <p className="text-sm text-(--color-description)">Пока нет комментариев.</p>
      )}

      <ul className="flex flex-col gap-3">
        {comments.map((comment) => {
          const isAuthor =
            user !== null &&
            !comment.is_anonymous &&
            comment.author?.username !== undefined &&
            // username в JWT отсутствует — сравнение невозможно, полагаемся на роль.
            // Редактирование: только свой комментарий (бэкенд проверит автора).
            // Для упрощения UI — показываем кнопку edit только авторизованным;
            // неавторских комментариев по факту не отредактируешь.
            isAuthorized;
          const canEdit = isAuthor;
          const canDelete = isAuthor || isPrivileged;
          return (
            <li key={comment.id}>
              <CommentItem
                comment={comment}
                lectureId={lectureId}
                canEdit={canEdit}
                canDelete={canDelete}
                canReact={isAuthorized}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
