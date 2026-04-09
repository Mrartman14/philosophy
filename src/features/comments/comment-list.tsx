import { getMe } from "@/utils/me";
import {
  canDeleteComment,
  canEditComment,
  whyCannotCreateComment,
  whyCannotReactToComment,
} from "./permissions";
import { LoginCta } from "@/components/permission/login-cta";
import { getComments } from "./api";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";

interface CommentListProps {
  lectureId: string;
}

export const CommentList: React.FC<CommentListProps> = async ({
  lectureId,
}) => {
  const me = await getMe();
  const createDeny = whyCannotCreateComment(me);

  let comments: Awaited<ReturnType<typeof getComments>>["data"] = [];
  let loadError = false;
  try {
    const result = await getComments(lectureId);
    comments = result.data;
  } catch {
    loadError = true;
  }

  return (
    <section className="flex flex-col gap-4 p-4 border-t border-(--color-border)">
      <h2 className="text-lg font-semibold">Комментарии</h2>

      {createDeny === null ? (
        <CommentForm lectureId={lectureId} allowAnonymous={true} />
      ) : createDeny === "guest" ? (
        <LoginCta
          message="Войдите, чтобы оставить комментарий"
          redirectTo={`/lectures/${lectureId}`}
        />
      ) : (
        <p
          role="status"
          className="text-sm text-(--color-description) p-3 border border-(--color-border) rounded-lg"
        >
          Комментировать нельзя — аккаунт ограничен.
          {" "}
          <span className="text-xs">
            (см. баннер сверху страницы)
          </span>
        </p>
      )}

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить комментарии.
        </p>
      )}

      {!loadError && comments.length === 0 && (
        <p className="text-sm text-(--color-description)">
          Пока нет комментариев.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {comments.map((comment) => {
          const canEdit = canEditComment(me, comment);
          const canDelete = canDeleteComment(me, comment);
          const reactionDeny = whyCannotReactToComment(me);
          return (
            <li key={comment.id}>
              <CommentItem
                comment={comment}
                lectureId={lectureId}
                canEdit={canEdit}
                canDelete={canDelete}
                reactionDeny={reactionDeny}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
