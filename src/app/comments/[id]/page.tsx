// src/app/comments/[id]/page.tsx
import { notFound } from "next/navigation";

import { SchemaContextProvider } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import {
  getCommentSchema,
  getCommentSubtree,
  CommentTree,
  CommentRevisions,
  CommentExportLinks,
} from "@/features/comments";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}

export const metadata = { title: "Комментарий" };

export default async function CommentSubtreePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { revision } = await searchParams;
  const [subtree, schema, astSchema] = await Promise.all([
    getCommentSubtree(id),
    getCommentSchema(),
    getAstSchema(),
  ]);
  if (!subtree?.root || !schema) notFound();

  const lectureId = subtree.root.lecture_id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Ветка обсуждения</h1>
        <CommentExportLinks kind="subtree" id={id} />
      </header>

      <SchemaContextProvider initial={astSchema} fallback={<CommentTree subtrees={[subtree]} lectureId={lectureId} schema={schema} />}>
        <CommentTree subtrees={[subtree]} lectureId={lectureId} schema={schema} />
      </SchemaContextProvider>

      <CommentRevisions
        commentId={id}
        selectedRevisionId={revision}
        basePath={`/comments/${id}`}
      />
    </div>
  );
}
