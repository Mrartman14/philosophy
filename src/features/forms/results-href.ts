// src/features/forms/results-href.ts
// Единая точка построения относительных ссылок на поверхности результатов формы.
// URLSearchParams сам кодирует значения и ставит правильный разделитель (?/&),
// убирая ручной риск рассинхрона escaping/разделителя между вызовами.

/** Ссылка на агрегат результатов формы (`/forms/{id}/results`), опц. с share-token. */
export function formResultsHref(formId: string, token?: string): string {
  const qs = token ? `?${new URLSearchParams({ token }).toString()}` : "";
  return `/forms/${formId}/results${qs}`;
}

/** Ссылка на колонку ответов одного поля (`/forms/{id}/fields/{fieldId}`), опц. с page (?p) и token. */
export function fieldAnswersHref(
  formId: string,
  fieldId: string,
  opts: { token?: string; page?: number } = {},
): string {
  const params = new URLSearchParams();
  if (opts.page) params.set("p", String(opts.page));
  if (opts.token) params.set("token", opts.token);
  const qs = params.toString();
  return `/forms/${formId}/fields/${fieldId}${qs ? `?${qs}` : ""}`;
}
