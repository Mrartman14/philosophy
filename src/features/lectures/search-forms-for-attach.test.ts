import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));
vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return { ...actual, getT: () => Promise.resolve((key: string) => key) };
});

import { searchFormsForAttach } from "./actions";

beforeEach(() => {
  get.mockReset();
});

const FORMS = [
  { id: "f1", title: "Опрос после лекции" },
  { id: "f2", title: "Регистрация на семинар" },
  { id: "f3", title: "Обратная связь" },
  { id: "nope" }, // без title → label = id; без id отфильтровывается (см. ниже)
];

describe("searchFormsForAttach", () => {
  it("фильтрует по подстроке title (без учёта регистра) и режет offset/limit", async () => {
    get.mockResolvedValue({ data: { data: FORMS }, error: undefined });
    const r = await searchFormsForAttach({ q: "опрос", offset: 0, limit: 10 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.data).toEqual([{ id: "f1", label: "Опрос после лекции" }]);
    expect(r.data.total).toBe(1);
  });

  it("пустой q → все формы (с id); total = размер набора; пагинация работает", async () => {
    get.mockResolvedValue({ data: { data: FORMS }, error: undefined });
    const r = await searchFormsForAttach({ q: "", offset: 1, limit: 2 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    // 4 формы, у "nope" нет title → label="nope"; формы без id отбрасываются (тут все с id)
    expect(r.data.total).toBe(4);
    expect(r.data.data.map((f) => f.id)).toEqual(["f2", "f3"]);
  });

  it("формы без id отбрасываются", async () => {
    get.mockResolvedValue({ data: { data: [{ title: "no id" }, { id: "f1", title: "ok" }] }, error: undefined });
    const r = await searchFormsForAttach({ q: "", offset: 0, limit: 10 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.data).toEqual([{ id: "f1", label: "ok" }]);
    expect(r.data.total).toBe(1);
  });
});
