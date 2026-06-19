// src/features/comments/ui/comment-tree-view.tsx
// Чистое изоморфное read-only дерево комментов: рекурсивно рендерит CommentNodeView
// через groupByParent. Для офлайн-рендера снимка (slice L). Без серверных зависимостей.
import { groupByParent } from "../comment-tree-utils";
import type { Comment, RootSubtree } from "../types";

import { CommentNodeView } from "./comment-node-view";

function BranchView({
  node,
  childrenMap,
}: {
  node: Comment;
  childrenMap: Map<string | null, Comment[]>;
}) {
  const kids = childrenMap.get(node.id) ?? [];
  return (
    <li className="flex flex-col gap-2">
      <CommentNodeView comment={node} />
      {kids.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l border-(--color-border) pl-3">
          {kids.map((kid) => (
            <BranchView key={kid.id} node={kid} childrenMap={childrenMap} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentTreeView({ subtrees }: { subtrees: RootSubtree[] }) {
  if (subtrees.length === 0) {
    return (
      <p className="text-sm text-(--color-fg-muted)">Комментариев пока нет.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {subtrees.flatMap((st) => {
        const root = st.root;
        if (!root) return [];
        const childrenMap = groupByParent([...(st.descendants ?? [])]);
        return [<BranchView key={root.id} node={root} childrenMap={childrenMap} />];
      })}
    </ul>
  );
}
