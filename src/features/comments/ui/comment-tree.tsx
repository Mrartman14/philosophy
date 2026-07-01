// src/features/comments/ui/comment-tree.tsx
import { getT } from "@/i18n";

import { groupByParent } from "../comment-tree-utils";
import { commentNodeId } from "../thread-scroll";
import type { Comment, CommentSchema, RootSubtree } from "../types";

import { CommentNode } from "./comment-node";

interface BranchProps {
  node: Comment;
  childrenMap: Map<string | null, Comment[]>;
  lectureId: string;
  schema: CommentSchema;
  token?: string | undefined;
}

function Branch({ node, childrenMap, lectureId, schema, token }: BranchProps) {
  const kids = childrenMap.get(node.id) ?? [];
  return (
    <li id={commentNodeId(node.id)} className="flex flex-col gap-2">
      <CommentNode comment={node} lectureId={lectureId} schema={schema} token={token} />
      {kids.length > 0 && (
        <ul className="ms-2 flex flex-col gap-2 border-s border-(--color-border) ps-3">
          {kids.map((kid) => (
            <Branch
              key={kid.id}
              node={kid}
              childrenMap={childrenMap}
              lectureId={lectureId}
              schema={schema}
              token={token}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface Props {
  subtrees: RootSubtree[];
  lectureId: string;
  schema: CommentSchema;
  /** ?token= (share-link) — доступ к аннотациям комментов приватной лекции. */
  token?: string | undefined;
}

export async function CommentTree({ subtrees, lectureId, schema, token }: Props) {
  const t = await getT("comments");

  if (subtrees.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("empty")}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {subtrees.flatMap((st) => {
        const root = st.root;
        if (!root) return [];
        const all = [...(st.descendants ?? [])];
        const childrenMap = groupByParent(all);
        return [
          <Branch
            key={root.id}
            node={root}
            childrenMap={childrenMap}
            lectureId={lectureId}
            schema={schema}
            token={token}
          />,
        ];
      })}
    </ul>
  );
}
