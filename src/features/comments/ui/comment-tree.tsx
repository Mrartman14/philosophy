// src/features/comments/ui/comment-tree.tsx
import { CommentNode } from "./comment-node";
import type { Comment, CommentSchema, RootSubtree } from "../types";

/** Строит map parent_id → children из плоского списка узлов. */
function groupByParent(nodes: Comment[]): Map<string | null, Comment[]> {
  const map = new Map<string | null, Comment[]>();
  for (const n of nodes) {
    const key = n.parent_id ?? null;
    const arr = map.get(key) ?? [];
    arr.push(n);
    map.set(key, arr);
  }
  return map;
}

interface BranchProps {
  node: Comment;
  childrenMap: Map<string | null, Comment[]>;
  lectureId: string;
  schema: CommentSchema;
}

function Branch({ node, childrenMap, lectureId, schema }: BranchProps) {
  const kids = childrenMap.get(node.id) ?? [];
  return (
    <li className="flex flex-col gap-2">
      <CommentNode comment={node} lectureId={lectureId} schema={schema} />
      {kids.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l border-(--color-border) pl-3">
          {kids.map((kid) => (
            <Branch
              key={kid.id}
              node={kid}
              childrenMap={childrenMap}
              lectureId={lectureId}
              schema={schema}
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
}

export function CommentTree({ subtrees, lectureId, schema }: Props) {
  if (subtrees.length === 0) {
    return <p className="text-sm text-(--color-description)">Комментариев пока нет.</p>;
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
          />,
        ];
      })}
    </ul>
  );
}
