// src/features/comments/ui/comment-section.tsx
import type { ReactNode } from "react";

import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import {
  getCommentSchema,
  getLectureComments,
  searchComments,
} from "../api";
import type { CommentListResult, CommentSearchResult } from "../api";
import { canCreateComment, canSearchComments } from "../permissions";
import type { CommentSchema, CommentType } from "../types";

import { CommentCreateForm } from "./comment-create-form";
import { CommentExportLinks } from "./comment-export-links";
import { CommentSearch } from "./comment-search";
import { CommentTree } from "./comment-tree";


interface Props {
  lectureId: string;
  /** ?cq= из searchParams страницы лекции (поиск). */
  query?: string | undefined;
}

/**
 * Дерево / результаты поиска. Это read-only-контент: AstRender внутри узлов
 * провайдер не требует. Reply/edit-формы в узлах закрыты по умолчанию и
 * монтируют AstEditor (который зовёт useSchema) только при открытии — поэтому
 * провайдер должен присутствовать выше по дереву, но сам контент рендерится
 * и без него (даже как fallback).
 */
function renderContent(
  searching: boolean,
  search: CommentSearchResult | null,
  list: CommentListResult | null,
  lectureId: string,
  schema: CommentSchema,
  noSnippet: string,
  searchFoundCount: (count: number) => string,
  typeLabel: (type: CommentType) => string,
): ReactNode {
  if (searching && search) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-(--color-fg-muted)">{searchFoundCount(search.total)}</p>
        <ul className="flex flex-col gap-2">
          {search.items.map((item) => (
            <li key={item.id} className="rounded border border-(--color-border) p-2 text-sm">
              <span className="text-xs text-(--color-fg-muted)">
                {typeLabel(item.type ?? "claim")} ·{" "}
                {item.author?.username ?? "—"}
              </span>
              <p>
                {item.id ? (
                  <a href={`/comments/${item.id}`} className="hover:underline">
                    {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- snippet может быть "" (пустой комментарий), "" → noSnippet намеренно */}
                    {item.snippet || noSnippet}
                  </a>
                ) : (
                  item.snippet
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return list ? (
    <CommentTree subtrees={list.subtrees} lectureId={lectureId} schema={schema} />
  ) : null;
}

export async function CommentSection({ lectureId, query }: Props) {
  const [me, schema, t] = await Promise.all([
    getMe(),
    getCommentSchema(),
    getT("comments"),
  ]);

  if (!schema) {
    return <p className="text-sm text-(--color-fg-muted)">{t("unavailable")}</p>;
  }

  const rootTypes = (schema.allowed_roots ?? []);
  const trimmed = (query ?? "").trim();
  const searching = trimmed.length > 0 && canSearchComments(me);

  const [list, search, astSchema] = await Promise.all([
    searching ? Promise.resolve(null) : getLectureComments(lectureId),
    searching ? searchComments(lectureId, trimmed) : Promise.resolve(null),
    getAstSchema(),
  ]);

  const content = renderContent(
    searching,
    search,
    list,
    lectureId,
    schema,
    t("noSnippet"),
    (count) => t("searchFoundCount", { count }),
    (type) => t(`type.${type}`),
  );
  const canCreate = canCreateComment(me);

  return (
    <section className="flex flex-col gap-5" aria-label={t("sectionLabel")}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t("sectionHeading")}</h2>
        <CommentExportLinks kind="lecture" id={lectureId} />
      </header>

      {canSearchComments(me) && <CommentSearch defaultQuery={trimmed} />}

      {/*
        Один SchemaContextProvider оборачивает и дерево (reply/edit-формы с
        AstEditor внутри узлов), и форму создания — любой AstEditor в поддереве
        получит схему после client-фетча. Чтобы read-only-контент был виден
        сразу (SSR + до загрузки схемы), тот же контент передаём как fallback.
        Provider — client component, дети — server (допустимо в App Router).
        Схема гидрируется серверно (initial) — браузер за ней не ходит.
      */}
      <SchemaContextProvider initial={astSchema} fallback={content}>
        {content}
        {canCreate ? (
          <CommentCreateForm lectureId={lectureId} rootTypes={rootTypes} />
        ) : (
          <p className="text-sm text-(--color-fg-muted)">
            {t("loginPrompt")}
          </p>
        )}
      </SchemaContextProvider>
    </section>
  );
}
