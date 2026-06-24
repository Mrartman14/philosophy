import type { AstNode, AstMark } from "./types";

/** data-block-id ТОЛЬКО для текст-блоков. node.attrs.blockId кладёт deserializer. */
export function blockIdAttr(node: AstNode): Record<string, string> {
  const id = (node.attrs as { blockId?: unknown } | undefined)?.blockId;
  return typeof id === "string" && id.length > 0 ? { "data-block-id": id } : {};
}

export function headingTag(node: AstNode): string {
  const raw = (node.attrs as { level?: unknown } | undefined)?.level;
  const lvl = typeof raw === "number" && raw >= 1 && raw <= 6 ? raw : 2;
  return `h${lvl}`;
}

/** Базовые атрибуты ссылки (структура). Санитайз — read-only enhancement. */
export function linkAttrs(mark: AstMark): Record<string, string> {
  const href = (mark.attrs as { href?: unknown } | undefined)?.href;
  return typeof href === "string" && href.length > 0 ? { href } : {};
}

const REF_PREFIX: Record<string, string> = {
  glossary_ref: "/glossary/",
  document_ref: "/documents/",
  media_ref: "/media/",
  comment_ref: "/comments/",
  canvas_ref: "/canvases/",
};

/** nav-ref → <a href из id>. Решение: <a> в edit И read. null если id пуст/тип неизвестен. */
export function navRefAttrs(mark: AstMark): Record<string, string> | null {
  const type = mark.type as string | undefined;
  const id = (mark.attrs as { id?: unknown } | undefined)?.id;
  if (!type || !(type in REF_PREFIX) || typeof id !== "string" || id.length === 0) return null;
  return { href: REF_PREFIX[type] + id, "data-mark": type, class: `nav-ref nav-ref--${type}` };
}
