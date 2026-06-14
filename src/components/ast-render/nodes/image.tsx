// src/components/ast-render/nodes/image.tsx
import type { ReactNode } from "react";

import { resolveStorageUrl } from "@/components/ast-editor/upload/storage-url";

interface Props {
  attrs: Record<string, unknown> | undefined;
}

// Бек (internal/ast/schema.go NodeImage): storage_key — ровно 64 hex-символа
// (sha256 content-address). Строгая проверка ключа исключает инъекцию в URL —
// isSafeHref здесь не нужен.
const STORAGE_KEY_RE = /^[0-9a-f]{64}$/i;

export function ImageNode({ attrs }: Props): ReactNode {
  const storageKey = attrs?.storage_key;
  const alt = attrs?.alt;
  const caption = attrs?.caption;
  if (typeof storageKey !== "string" || !STORAGE_KEY_RE.test(storageKey)) {
    return <div data-unsupported="image" data-reason="missing-or-invalid-storage-key" />;
  }
  return (
    <figure>
      {/* AstRender — server-only, intentionally uses native <img> to avoid client-side next/image runtime; see docs/superpowers/specs/2026-05-02-glossary-feature-design.md §4.1 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveStorageUrl(storageKey)}
        alt={typeof alt === "string" ? alt : ""}
        loading="lazy"
      />
      {typeof caption === "string" && caption.length > 0 ? (
        <figcaption>{caption}</figcaption>
      ) : null}
    </figure>
  );
}
