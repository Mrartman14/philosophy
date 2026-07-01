import { beforeEach, describe, expect, it, vi } from "vitest";

// getAllAnnotationsFor собирает ВСЕ страницы per-entity ручки
// (GET /api/{entity}/{id}/annotations), устойчиво к server-side кламп limit — тот же
// инвариант, что get-all-lecture-annotations.test для лекционного агрегата (общий
// paginateAll). Живой прод-путь: маргиналии документа (DocumentAnnotations, M11/#24).

const get = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));
vi.mock("@/i18n", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/i18n")>();
  return { ...orig, getT: () => Promise.resolve((key: string) => key) };
});

// импорт ПОСЛЕ vi.mock (hoisted)
import { getAllAnnotationsFor } from "./api";

// React cache() мемоизирует по идентичности аргументов → каждому тесту свой id.
let seq = 0;
function freshDoc() {
  seq += 1;
  return `doc-${seq}`;
}

function ann(id: string) {
  return { id, body: { blocks: [] } };
}

/** Сервер КЛАМПИТ limit к `serverCap`; всего `total` аннотаций; последняя страница
 *  частичная/пустая. openapi-fetch зовёт GET(path, init) — читаем init.params.query. */
function paginatedServer(total: number, serverCap: number) {
  return (
    _path: string,
    init: { params: { query: { offset: number; limit: number } } },
  ) => {
    const { offset, limit } = init.params.query;
    const pageSize = Math.min(limit, serverCap);
    const slice: ReturnType<typeof ann>[] = [];
    for (let i = offset; i < Math.min(offset + pageSize, total); i++) {
      slice.push(ann(`a${i}`));
    }
    return Promise.resolve({
      data: { data: slice, pagination: { total, offset, limit: pageSize } },
      error: undefined,
      response: { status: 200 },
    });
  };
}

describe("getAllAnnotationsFor — полная проходка per-entity, устойчива к кламп limit", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("собирает ВСЕ страницы, когда бэк клампит limit (page < requestedLimit)", async () => {
    // 250 аннотаций, cap 100 → страницы 100, 100, 50, затем пустая. Запрошенный
    // limit 200 → на каждой странице length < 200: старый `< limit`-предикат оборвал
    // бы после первой, МОЛЧА потеряв документ >cap.
    get.mockImplementation(paginatedServer(250, 100));

    const all = await getAllAnnotationsFor("document", freshDoc());

    expect(all).toHaveLength(250);
    expect(new Set(all.map((a) => a.id)).size).toBe(250);
    expect(all[0]?.id).toBe("a0");
    expect(all[249]?.id).toBe("a249");
  });

  it("терминирует на ПУСТОЙ странице (total кратен серверному cap)", async () => {
    get.mockImplementation(paginatedServer(200, 100));

    const all = await getAllAnnotationsFor("document", freshDoc());

    expect(all).toHaveLength(200);
    // 2 непустые + 1 пустая (терминатор) = 3 вызова.
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("пустая сущность → пустой массив, один запрос", async () => {
    get.mockImplementation(paginatedServer(0, 100));

    const all = await getAllAnnotationsFor("document", freshDoc());

    expect(all).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
