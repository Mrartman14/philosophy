"use client";
// src/components/ast-editor/lazy-ast-editor.tsx
// Лениво-загружаемая обёртка над AstEditor. Сам AstEditor статически тянет весь
// @tiptap/prosemirror (~140KB gzip). Прикладные формы ре-экспортятся из своих
// feature-barrel'ов рядом с view-компонентами; turbopack НЕ отшейкивает такой
// barrel (особенно через "use client"-границы), поэтому статический импорт
// редактора в форме утекает в первый бандл КАЖДОГО потребителя barrel'а — в т.ч.
// read-only страниц и (через ActiveBanners в root layout) глобального shell.
// next/dynamic держит редактор за ленивой границей: чанк грузится только когда
// форма реально смонтирована. Формы импортируют ИМЕННО этот модуль напрямую
// (deep-import @/components/* разрешён), НЕ через barrel @/components/ast-editor —
// иначе тот же barrel снова притянет AstEditor статически.
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { AstEditor as AstEditorType } from "./ast-editor";

const AstEditorLazy = dynamic(
  () => import("./ast-editor").then((m) => m.AstEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[8rem] rounded border border-(--color-border) bg-(--color-surface)"
        aria-hidden
      />
    ),
  },
);

export function LazyAstEditor(props: ComponentProps<typeof AstEditorType>) {
  return <AstEditorLazy {...props} />;
}
