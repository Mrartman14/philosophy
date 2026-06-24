/**
 * Вариант A (FE-оркестрация): createLecture умеет прикрепить уже готовые
 * документы сразу после создания лекции, читая их id из скрытого поля формы
 * `attach_document_ids` (JSON-массив). Бек без изменений — две существующие
 * ручки (POST /api/admin/lectures → POST /api/lectures/{id}/attachments).
 *
 * Проверяем:
 *  - после create идёт по одному attach на каждый id, в порядке выбора (sort_order=i);
 *  - без id — только create, без attach;
 *  - best-effort: неудачный attach НЕ валит создание лекции;
 *  - без capability entity.attach — attach пропускается;
 *  - revalidate: list-тег от create + item-тег при наличии attach.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Tags } from "@/api/tags";
import * as revalidateModule from "@/utils/revalidate";

const post = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

const getLectureByIdImpl = vi.fn();
vi.mock("./api", () => ({
  getLectureById: (...args: unknown[]) => getLectureByIdImpl(...args) as unknown,
}));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return {
    ...actual,
    getT: () => Promise.resolve((key: string) => key),
  };
});

import { createLecture } from "./actions";

const LECTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_ID = "real-owner-id";
const IK = "idem-key-attach-001";
const initial = { success: false as const, error: "" };

function meWith(capabilities: string[]) {
  return {
    id: OWNER_ID,
    username: "owner",
    role: "user" as const,
    status: "active" as const,
    capabilities,
  };
}

function lectureSuccessEnvelope() {
  return {
    data: {
      data: {
        id: LECTURE_ID,
        title: "Test",
        date: "2024-01-01",
        description: "",
        visibility: "private",
        owner_id: OWNER_ID,
      },
    },
    error: undefined,
  };
}

function voidSuccessEnvelope() {
  return { data: undefined, error: undefined };
}

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function revalidateSpy() {
  return vi.mocked(revalidateModule.revalidateEntity);
}

beforeEach(() => {
  post.mockReset();
  getMeImpl.mockReset();
  getLectureByIdImpl.mockReset();
  revalidateSpy().mockReset();
  getMeImpl.mockResolvedValue(meWith(["lecture.create", "entity.attach"]));
});

describe("createLecture — прикрепление готовых документов (Вариант A)", () => {
  it("после create прикрепляет каждый документ в порядке выбора (sort_order=i)", async () => {
    post.mockResolvedValueOnce(lectureSuccessEnvelope());
    post.mockResolvedValue(voidSuccessEnvelope());

    const result = await createLecture(
      initial,
      form({
        title: "L",
        description: "",
        date: "2024-06-01",
        attach_document_ids: JSON.stringify(["doc-1", "doc-2"]),
        __idempotency_key: IK,
      }),
    );

    expect(result).toMatchObject({ success: true, data: { id: LECTURE_ID } });
    expect(post).toHaveBeenCalledTimes(3);

    const [createPath] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(createPath).toBe("/api/admin/lectures");

    const [a1Path, a1Opts] = post.mock.calls[1] as [string, Record<string, unknown>];
    expect(a1Path).toBe("/api/lectures/{lectureID}/attachments");
    expect((a1Opts.params as { path: { lectureID: string } }).path.lectureID).toBe(LECTURE_ID);
    expect(a1Opts.body).toMatchObject({ entity_id: "doc-1", entity_type: "document", sort_order: 0 });

    const [, a2Opts] = post.mock.calls[2] as [string, Record<string, unknown>];
    expect(a2Opts.body).toMatchObject({ entity_id: "doc-2", entity_type: "document", sort_order: 1 });
  });

  it("без attach_document_ids делает только create (без attach)", async () => {
    post.mockResolvedValue(lectureSuccessEnvelope());

    const result = await createLecture(
      initial,
      form({ title: "L", description: "", date: "2024-06-01", __idempotency_key: IK }),
    );

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    expect((post.mock.calls[0] as [string])[0]).toBe("/api/admin/lectures");
  });

  it("best-effort: неудачный attach не валит создание лекции", async () => {
    post.mockResolvedValueOnce(lectureSuccessEnvelope());
    post.mockResolvedValueOnce({ data: undefined, error: { code: "NOT_FOUND", error: "x" } });
    post.mockResolvedValue(voidSuccessEnvelope());

    const result = await createLecture(
      initial,
      form({
        title: "L",
        description: "",
        date: "2024-06-01",
        attach_document_ids: JSON.stringify(["doc-1", "doc-2"]),
        __idempotency_key: IK,
      }),
    );

    // лекция создана несмотря на падение одного attach; оба attach попытаны
    expect(result).toMatchObject({ success: true, data: { id: LECTURE_ID } });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("без capability entity.attach attach пропускается (только create)", async () => {
    getMeImpl.mockResolvedValue(meWith(["lecture.create"]));
    post.mockResolvedValue(lectureSuccessEnvelope());

    const result = await createLecture(
      initial,
      form({
        title: "L",
        description: "",
        date: "2024-06-01",
        attach_document_ids: JSON.stringify(["doc-1"]),
        __idempotency_key: IK,
      }),
    );

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
  });

  it("revalidate: list-тег от create + item-тег при наличии attach", async () => {
    post.mockResolvedValueOnce(lectureSuccessEnvelope());
    post.mockResolvedValue(voidSuccessEnvelope());

    await createLecture(
      initial,
      form({
        title: "L",
        description: "",
        date: "2024-06-01",
        attach_document_ids: JSON.stringify(["doc-1"]),
        __idempotency_key: IK,
      }),
    );

    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
  });
});
