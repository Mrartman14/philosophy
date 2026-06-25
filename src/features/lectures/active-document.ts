// src/features/lectures/active-document.ts

/**
 * Активный документ лекции для URL-driven просмотра (?doc=). Возвращает docParam,
 * если он среди id документов; иначе первый документ с id; иначе null.
 *
 * СТОПГАП: дефолт = первый по sort_order. Когда бэк добавит признак основного
 * документа (is_primary / primary_document_id), заменить дефолт на него.
 */
export function resolveActiveDocId(
  documents: { id?: string }[],
  docParam: string | undefined,
): string | null {
  const ids = documents.map((d) => d.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;
  if (docParam && ids.includes(docParam)) return docParam;
  return ids[0];
}
