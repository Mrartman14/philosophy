import { getMe } from "@/utils/me";
import {
  canCreateComment,
  canDeleteComment,
  canEditComment,
  canReactToComment,
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

      {canCreateComment(me) ? (
        <CommentForm lectureId={lectureId} allowAnonymous={true} />
      ) : !me ? (
        <LoginCta
          message="Войдите, чтобы оставить комментарий"
          redirectTo={`/lectures/${lectureId}`}
        />
      ) : null /* suspended/banned: глобальный StatusBanner уже показан */}

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
                canReact={canReactToComment(me)}
                reactionDeny={reactionDeny}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
