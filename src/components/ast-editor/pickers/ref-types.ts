import type { NamespaceT } from "@/i18n";

import {
  searchGlossary,
  searchDocuments,
  searchMedia,
  searchLectures,
  searchCommentsByLecture,
  type GlossaryTerm,
  type DocumentSummary,
  type MediaSummary,
  type Lecture,
  type CommentSummary,
} from "./actions";
import type { AsyncFetcher } from "./use-async-combobox-items";

/** Имена марок-ссылок AST (подмножество `ast.MarkType`, см. src/api/schema.ts). */
export type RefMark = "glossary_ref" | "document_ref" | "media_ref" | "comment_ref";

/**
 * Валидный i18n-ключ namespace `editor` (зеркалит precedent admin-access.ts:
 * `Parameters<NamespaceT<"admin">>[0]`). Типизирует динамические ключи REF_TYPES,
 * чтобы `t(def.labelKey)` проверялся компилятором БЕЗ каста (Task 12).
 */
export type EditorKey = Parameters<NamespaceT<"editor">>[0];

/**
 * Контекст поиска категории ссылки.
 * - `global` — плоский поиск по всей сущности.
 * - `parent` — двухступенчатый: сначала выбор родителя (лекции), затем поиск
 *   дочерних элементов (комментариев) в её контексте.
 */
export type RefScope =
  | { kind: "global" }
  | {
      kind: "parent";
      parentPlaceholderKey: EditorKey;
      parentFetch: AsyncFetcher<Lecture>;
      parentRender: (l: Lecture) => React.ReactNode;
      parentKey: (l: Lecture) => string;
      crumbLabel: (l: Lecture) => string;
      /** Замыкается на выбранного родителя → fetcher дочерних элементов. */
      childFetch: (parentId: string) => AsyncFetcher<CommentSummary>;
    };

export interface RefTypeDef<T> {
  id: "glossary" | "document" | "media" | "comment";
  mark: RefMark;
  /** i18n-ключ ярлыка вкладки (каталог `editor`). */
  labelKey: EditorKey;
  /** i18n-ключ плейсхолдера строки поиска (каталог `editor`). */
  placeholderKey: EditorKey;
  scope: RefScope;
  /** Fetcher для `scope.kind === "global"` (для parent-scope лежит в `scope`). */
  fetch?: AsyncFetcher<T>;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  /** Текст метки для вставляемой ссылки. */
  getLabel: (item: T) => string;
}

const glossary: RefTypeDef<GlossaryTerm> = {
  id: "glossary",
  mark: "glossary_ref",
  labelKey: "refCategoryGlossary",
  placeholderKey: "glossaryPlaceholder",
  scope: { kind: "global" },
  fetch: searchGlossary,
  renderItem: (g) => g.title ?? "—",
  getKey: (g) => g.id ?? "",
  getLabel: (g) => g.title ?? g.id ?? "",
};

const document: RefTypeDef<DocumentSummary> = {
  id: "document",
  mark: "document_ref",
  labelKey: "refCategoryDocument",
  placeholderKey: "documentPlaceholder",
  scope: { kind: "global" },
  fetch: searchDocuments,
  // DocumentSummary НЕ имеет title (только filename) — подтверждено по schema.ts.
  renderItem: (d) => d.filename ?? "—",
  getKey: (d) => d.id ?? "",
  getLabel: (d) => d.filename ?? d.id ?? "",
};

const media: RefTypeDef<MediaSummary> = {
  id: "media",
  mark: "media_ref",
  labelKey: "refCategoryMedia",
  placeholderKey: "mediaPlaceholder",
  scope: { kind: "global" },
  // Медиа-фасет (video/audio) намеренно НЕ переносим — плоский поиск по имени.
  // searchMedia с опциональным 4-м арг `type?` присваиваем как AsyncFetcher<MediaSummary>
  // напрямую (функция с меньшим числом обязательных параметров совместима).
  fetch: searchMedia,
  renderItem: (m) => m.filename ?? "—",
  getKey: (m) => m.id ?? "",
  getLabel: (m) => m.filename ?? m.id ?? "",
};

const comment: RefTypeDef<CommentSummary> = {
  id: "comment",
  mark: "comment_ref",
  labelKey: "refCategoryComment",
  placeholderKey: "commentPlaceholder",
  scope: {
    kind: "parent",
    parentPlaceholderKey: "lecturePlaceholder",
    parentFetch: searchLectures,
    // Lecture.title / Lecture.id — required по schema.ts (фоллбеки не нужны).
    parentRender: (l) => l.title,
    parentKey: (l) => l.id,
    crumbLabel: (l) => l.title,
    childFetch: (parentId) => (q, o, l) => searchCommentsByLecture(parentId, q, o, l),
  },
  renderItem: (c) => c.snippet ?? "—",
  getKey: (c) => c.id ?? "",
  getLabel: (c) => c.snippet ?? c.id ?? "",
};

/** Порядок элементов = порядок вкладок в пикере. */
export const REF_TYPES: RefTypeDef<unknown>[] = [
  glossary as RefTypeDef<unknown>,
  document as RefTypeDef<unknown>,
  media as RefTypeDef<unknown>,
  comment as RefTypeDef<unknown>,
];
