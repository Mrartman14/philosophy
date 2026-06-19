"use client";
// src/features/comments/ui/lazy-ast-editor.tsx
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { AstEditor as AstEditorType } from "@/components/ast-editor";
import { useT } from "@/i18n/client";

function EditorLoadingFallback() {
  const t = useT("comments");
  return (
    <div className="min-h-[8rem] rounded border border-(--color-border) bg-(--color-surface) flex items-start p-3">
      <span className="text-sm text-(--color-fg-muted)">{t("editorLoading")}</span>
    </div>
  );
}

const AstEditorLazy = dynamic(
  () => import("@/components/ast-editor").then((m) => m.AstEditor),
  { ssr: false, loading: () => <EditorLoadingFallback /> },
);

export function LazyAstEditor(props: ComponentProps<typeof AstEditorType>) {
  return <AstEditorLazy {...props} />;
}
