// src/app/_offline/descriptors/lecture-descriptor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  lectureDescriptor,
  extractImageKeysFromBlocks,
  type LectureSnapshot,
} from "./lecture-descriptor";

// vi.hoisted + vi.mock автоматически поднимаются vitest'ом ВЫШЕ статических импортов,
// поэтому моки применяются до загрузки lecture-descriptor (статический import, как
// в эталонах проекта save-offline.test.ts / image-button.test.tsx; без top-level await).
const getLectureById = vi.hoisted(() => vi.fn());
const getLectureDocuments = vi.hoisted(() => vi.fn());
const getLectureTags = vi.hoisted(() => vi.fn());
const getLectureComments = vi.hoisted(() => vi.fn());

vi.mock("@/features/lectures", () => ({ getLectureById, getLectureDocuments }));
vi.mock("@/features/tags", () => ({ getLectureTags }));
vi.mock("@/features/comments", () => ({ getLectureComments }));

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);
const KEY_C = "c".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractImageKeysFromBlocks", () => {
  it("берёт storage_key из image-блока верхнего уровня", () => {
    expect(
      extractImageKeysFromBlocks([{ type: "image", attrs: { storage_key: KEY_A } }]),
    ).toEqual([KEY_A]);
  });
  it("рекурсивно обходит вложенные content", () => {
    expect(
      extractImageKeysFromBlocks([
        { type: "list", content: [{ type: "image", attrs: { storage_key: KEY_B } }] },
      ]),
    ).toEqual([KEY_B]);
  });
  it("игнорирует не-image и невалидные ключи", () => {
    expect(
      extractImageKeysFromBlocks([
        { type: "paragraph", text: "hi" },
        { type: "image", attrs: { storage_key: "not-a-hash" } },
        { type: "image", attrs: {} },
      ]),
    ).toEqual([]);
  });
});

describe("lectureDescriptor.entity/pathSegment", () => {
  it("entity === 'lectures' (значение Tags.LECTURES)", () => {
    expect(lectureDescriptor.entity).toBe("lectures");
    expect(lectureDescriptor.pathSegment).toBe("lectures");
  });
});

describe("lectureDescriptor.extractImageKeys", () => {
  it("собирает обложку + картинки документов/комментов, дедуп + валидация", () => {
    const snap: LectureSnapshot = {
      lecture: {
        id: "l1",
        title: "T",
        date: "2026-01-01",
        description: "desc",
        owner: { id: "o" },
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        visibility: "public",
        cover_image_key: KEY_A,
      },
      tags: [],
      documents: [{ id: "d1", blocks: [{ type: "image", attrs: { storage_key: KEY_B } }] }],
      comments: [
        {
          root: {
            id: "c1",
            author: { id: "u" },
            lecture_id: "l1",
            type: "claim",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            blocks: [{ type: "image", attrs: { storage_key: KEY_C } }],
          },
          descendants: [],
        },
      ],
    };
    expect(lectureDescriptor.extractImageKeys(snap).sort()).toEqual(
      [KEY_A, KEY_B, KEY_C].sort(),
    );
  });

  it("дедуплицирует повторяющиеся ключи", () => {
    const snap: LectureSnapshot = {
      lecture: {
        id: "l1", title: "T", date: "d", description: "x", owner: { id: "o" },
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
        visibility: "public", cover_image_key: KEY_A,
      },
      tags: [],
      documents: [{ id: "d1", blocks: [{ type: "image", attrs: { storage_key: KEY_A } }] }],
      comments: [],
    };
    expect(lectureDescriptor.extractImageKeys(snap)).toEqual([KEY_A]);
  });
});

describe("lectureDescriptor.assemble", () => {
  it("null, если лекция недоступна (404→null), фетчеры не зовутся", async () => {
    getLectureById.mockResolvedValue(null);
    expect(await lectureDescriptor.assemble("missing")).toBeNull();
    expect(getLectureTags).not.toHaveBeenCalled();
    expect(getLectureComments).not.toHaveBeenCalled();
  });

  it("собирает снимок: lecture + tags + documents + comments (одна страница)", async () => {
    getLectureById.mockResolvedValue({ id: "l1", title: "T" });
    getLectureTags.mockResolvedValue([{ name: "math" }]);
    getLectureDocuments.mockResolvedValue([{ id: "d1", blocks: [] }]);
    getLectureComments.mockResolvedValue({
      subtrees: [{ root: { id: "c1" } }],
      total: 1,
      offset: 0,
      limit: 100,
    });

    const snap = await lectureDescriptor.assemble("l1");
    expect(snap).toEqual({
      lecture: { id: "l1", title: "T" },
      tags: [{ name: "math" }],
      documents: [{ id: "d1", blocks: [] }],
      comments: [{ root: { id: "c1" } }],
    });
    expect(getLectureComments).toHaveBeenCalledTimes(1);
  });

  it("склеивает ВСЕ страницы комментов до total (§225 — снимок не усекаем)", async () => {
    getLectureById.mockResolvedValue({ id: "l1" });
    getLectureTags.mockResolvedValue([]);
    getLectureDocuments.mockResolvedValue([]);
    // total=250 при page=100 → страницы offset 0,100,200 (3 вызова)
    getLectureComments.mockImplementation(
      (_id: string, opts: { offset?: number }) => {
        const offset = opts.offset ?? 0;
        return Promise.resolve({
          subtrees: [{ root: { id: `r-${offset}` } }],
          total: 250,
          offset,
          limit: 100,
        });
      },
    );

    const snap = await lectureDescriptor.assemble("l1");
    expect(getLectureComments).toHaveBeenCalledTimes(3);
    expect(snap?.comments).toEqual([
      { root: { id: "r-0" } },
      { root: { id: "r-100" } },
      { root: { id: "r-200" } },
    ]);
  });
});
