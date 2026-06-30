import { beforeEach, describe, expect, it, vi } from "vitest";

// getAllLectureAnnotations должен собрать ВСЕ страницы агрегата лекции, корректно
// даже если бэк КЛАМПИТ limit server-side (частая Go-конвенция, напр. cap 100):
// тогда первая страница вернёт меньше запрошенного → старый предикат
// `items.length < requestedLimit` оборвал бы обход после 1-й страницы и МОЛЧА
// потерял аннотации >cap. Робастная терминация — по ПУСТОЙ странице (+кап итераций).

const get = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));
// getT нужен только для текста ошибки — отдаём ключ.
vi.mock("@/i18n", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/i18n")>();
  return { ...orig, getT: () => Promise.resolve((key: string) => key) };
});

// импорт ПОСЛЕ vi.mock (hoisted)
import { getAllLectureAnnotations } from "./api";

// React cache() мемоизирует по идентичности аргумента → каждому тесту даём СВОЙ
// lectureId, чтобы прогоны не делили мемо-результат и не маскировали поведение.
let lectureSeq = 0;
function freshLecture() {
  lectureSeq += 1;
  return `lec-${lectureSeq}`;
}

function ann(id: string) {
  return { id, body: { blocks: [] } };
}

/**
 * Мок страничного фетча, где сервер КЛАМПИТ limit к `serverCap` (возвращает не
 * больше serverCap элементов на страницу), а всего есть `total` аннотаций.
 * Терминальная (последняя) страница — частичная/пустая.
 */
function paginatedServer(total: number, serverCap: number) {
  // openapi-fetch вызывает GET(path, init); нас интересует init.params.query.
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

describe("getAllLectureAnnotations — пагинация устойчива к server-side кламп limit", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("собирает ВСЕ страницы, когда бэк клампит limit (page < requestedLimit) на непоследней странице", async () => {
    // 250 аннотаций, бэк режет limit к 100 → 3 страницы (100, 100, 50), затем
    // пустая. Запрашиваемый limit движка = 200, поэтому НА КАЖДОЙ непустой странице
    // length (100 или 50) < 200 — старый предикат оборвал бы после первой.
    get.mockImplementation(paginatedServer(250, 100));

    const all = await getAllLectureAnnotations(freshLecture());

    expect(all).toHaveLength(250);
    // Все id уникальны и покрывают весь диапазон (нет тихой потери).
    expect(new Set(all.map((a) => a.id)).size).toBe(250);
    expect(all[0]?.id).toBe("a0");
    expect(all[249]?.id).toBe("a249");
  });

  it("терминирует на ПУСТОЙ странице (не зацикливается), когда total кратен серверному cap", async () => {
    // 200 аннотаций, cap 100 → страницы 100, 100, затем пустая (offset=200).
    get.mockImplementation(paginatedServer(200, 100));

    const all = await getAllLectureAnnotations(freshLecture());

    expect(all).toHaveLength(200);
    // 2 непустые + 1 пустая (терминатор) = 3 вызова GET.
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("единственная неполная страница (< limit) — собирает её и останавливается", async () => {
    get.mockImplementation(paginatedServer(15, 100));

    const all = await getAllLectureAnnotations(freshLecture());

    expect(all).toHaveLength(15);
  });

  it("пустая лекция → пустой массив, один запрос", async () => {
    get.mockImplementation(paginatedServer(0, 100));

    const all = await getAllLectureAnnotations(freshLecture());

    expect(all).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
