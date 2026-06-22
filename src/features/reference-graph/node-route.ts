import type { NodeType } from "./types";

// Чистая маршрутизация узла графа → путь сущности. Узел = документ или термин глоссария (NodeType).
// type отсутствует → null (узел не навигируем, onPick no-op).
export function nodeHref(type: NodeType | undefined, id: string | undefined): string | null {
  if (!id) return null;
  switch (type) {
    case "document":
      return `/documents/${id}`;
    case "glossary":
      return `/glossary/${id}`;
    default:
      return null;
  }
}
