// src/features/lectures/active-document.ts

/**
 * Активный документ лекции для URL-driven просмотра (?doc=). Возвращает docParam,
 * если он среди id документов; иначе основной документ лекции (is_entry); иначе
 * первый документ с id; иначе null.
 *
 * is_entry выставляется ТОЛЬКО листингом GET /api/lectures/{id}/documents
 * («основной документ»). Когда не выставлен ни на одном — фолбэк: первый по
 * sort_order.
 */
export function resolveActiveDocId(
  documents: { id?: string; is_entry?: boolean }[],
  docParam: string | undefined,
): string | null {
  const withId = documents.filter(
    (d): d is { id: string; is_entry?: boolean } => Boolean(d.id),
  );
  const [first] = withId;
  if (first === undefined) return null;
  if (docParam && withId.some((d) => d.id === docParam)) return docParam;
  const entry = withId.find((d) => d.is_entry);
  return entry ? entry.id : first.id;
}
