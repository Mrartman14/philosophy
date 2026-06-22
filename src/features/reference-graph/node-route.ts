// Чистая маршрутизация узла графа → путь сущности. Узел = документ или термин глоссария.
// FE-стопгап (открытый бэк-аск, см. spec §99–107): известные type — "document"/"glossary";
// неизвестный type → null (узел не навигируем, onPick no-op). TODO: сузить при ответе бэка.
export function nodeHref(type: string | undefined, id: string | undefined): string | null {
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
