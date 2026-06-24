import { resolveStorageUrl } from "@/utils/storage-url";

import type { AstNode, AstMark, NeutralChild } from "./types";

/**
 * content-address ключ файла (SHA256-hex). Локальная копия паттерна из
 * `ast-render/nodes/image.tsx` — `storage-url.ts` (frozen-зона) его НЕ экспортирует.
 */
export const STORAGE_KEY_RE = /^[0-9a-f]{64}$/i;

/**
 * data-block-id ТОЛЬКО для текст-блоков. Источник id различается по потребителю:
 * READ передаёт сырой AstBlock (id на верхнем уровне `node.id`), EDIT — PM-ноду
 * (id в `node.attrs.blockId`, куда его кладёт deserializer). Проверяем оба.
 */
export function blockIdAttr(node: AstNode): Record<string, string> {
  const id =
    (node as { id?: unknown }).id ?? (node.attrs as { blockId?: unknown } | undefined)?.blockId;
  return typeof id === "string" && id.length > 0 ? { "data-block-id": id } : {};
}

export function listAttrs(node: AstNode): Record<string, string> {
  const a = (node.attrs ?? {}) as { ordered?: unknown; start?: unknown };
  const ordered = a.ordered === true;
  const start = a.start;
  const startOk = ordered && (typeof start === "number" || typeof start === "string");
  return {
    ...blockIdAttr(node),
    "data-list": "",
    ...(startOk ? { start: String(start) } : {}),
  };
}

export function listItemAttrs(node: AstNode): Record<string, string> {
  // list_item — текст-блок субстрата аннотаций: несёт data-block-id (паритет с
  // текущим production block-renderer, block-renderer.test.tsx ассертит li1).
  const checked = (node.attrs as { checked?: unknown } | undefined)?.checked;
  return {
    ...blockIdAttr(node),
    ...(typeof checked === "boolean" ? { "data-checked": checked ? "true" : "false" } : {}),
  };
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
  const type = mark.type;
  const id = (mark.attrs as { id?: unknown } | undefined)?.id;
  if (typeof type !== "string" || typeof id !== "string" || id.length === 0) return null;
  const prefix = REF_PREFIX[type];
  if (prefix === undefined) return null;
  return { href: `${prefix}${id}`, "data-mark": type, class: `nav-ref nav-ref--${type}` };
}

/** code_block — текст-блок: несёт data-block-id + dir=ltr + опц. data-language. */
export function codeBlockAttrs(node: AstNode): Record<string, string> {
  const lang = (node.attrs as { language?: unknown } | undefined)?.language;
  return {
    ...blockIdAttr(node),
    dir: "ltr",
    ...(typeof lang === "string" && lang.length > 0 ? { "data-language": lang } : {}),
  };
}

export function cellAlignAttr(node: AstNode): Record<string, string> {
  const a = (node.attrs as { align?: unknown } | undefined)?.align;
  return a === "left" || a === "center" || a === "right" ? { "data-align": a } : {};
}

/** Дети <figure>: <img> (если валиден storage_key) + опц. <figcaption>. */
export function imageChildren(node: AstNode): NeutralChild[] {
  const a = node.attrs as { storage_key?: unknown; alt?: unknown; caption?: unknown } | undefined;
  const key = a?.storage_key;
  const out: NeutralChild[] = [];
  if (typeof key === "string" && STORAGE_KEY_RE.test(key)) {
    out.push([
      "img",
      {
        src: resolveStorageUrl(key),
        alt: typeof a?.alt === "string" ? a.alt : "",
        loading: "lazy",
      },
    ]);
  }
  if (typeof a?.caption === "string" && a.caption.length > 0) {
    out.push(["figcaption", {}, a.caption]);
  }
  return out;
}
