export function generateAnchorId(text?: string | null) {
  return (
    text ??
    ""
      .normalize("NFKD") // нормализация юникода
      .replace(/[\u0300-\u036f]/g, "") // удаление диакритики
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // только латиница, цифры, пробелы и дефисы
      .replace(/\s+/g, "-") // пробелы на дефисы
      .replace(/-+/g, "-") // несколько дефисов в один
      .replace(/^-+|-+$/g, "")
  ); // обрезка дефисов по краям
}
