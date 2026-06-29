// src/app/saved/saved-lecture-view.test.tsx
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// Мок i18n/client: useT("pages") возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: pages } = await import("@/i18n/messages/ru/pages");
  const { getFmt } = await import("@/i18n/format");
  return {
    useT: (ns: string) => {
      const catalog = ns === "pages" ? pages : {};
      return (key: string, params?: Record<string, unknown>) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of parts) {
          val = val?.[part];
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (!params) return val;
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return val.replace(/\{(\w+)\}/g, (_: string, k: string) => String(params[k] ?? k));
      };
    },
    useFmt: () => getFmt("ru"),
    useLocale: () => "ru" as const,
  };
});

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";
import {
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { SavedLectureView } from "./saved-lecture-view";

const saveOfflineMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/_offline/save-offline", () => ({ saveOffline: saveOfflineMock }));

const revalidateMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/_offline/revalidate-saved-bundle", () => ({
  revalidateSavedBundle: revalidateMock,
}));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  saveOfflineMock.mockReset().mockResolvedValue({ ok: true });
  // По умолчанию сверка ничего не меняет — старые тесты не затрагиваются.
  revalidateMock.mockReset().mockResolvedValue("skip");
  // jsdom по умолчанию online; фиксируем явно (один из тестов ставит false).
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});
afterEach(cleanup);

// Снимок хранится как unknown → литерал не обязан удовлетворять полным типам.
const SNAPSHOT = {
  lecture: {
    id: "l1",
    title: "Заголовок лекции",
    date: "2026-01-01",
    description: "Описание лекции",
    owner: { id: "o" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    visibility: "public",
  },
  tags: [{ name: "math" }],
  documents: [{ id: "d1", filename: "Документ 1", blocks: [] }],
  comments: [
    {
      root: {
        id: "c1",
        lecture_id: "l1",
        type: "claim",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        author: { id: "u", username: "alice" },
        blocks: [],
      },
      descendants: [],
    },
  ],
};

function seed(
  id: string,
  status: "complete" | "saving",
  snapshot: unknown,
  schemaVersion: number = OFFLINE_SCHEMA_VERSION,
) {
  return putSavedBundle({
    entity: "lectures",
    id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion,
    status,
    snapshot,
    imageKeys: [],
  });
}

describe("SavedLectureView", () => {
  it("рендерит снимок: заголовок, описание, документ, комменты", async () => {
    await seed("l1", "complete", SNAPSHOT);
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText("Заголовок лекции")).toBeTruthy();
    expect(screen.getByText("Описание лекции")).toBeTruthy();
    expect(screen.getByText("Документ 1")).toBeTruthy();
    expect(screen.getByText("alice")).toBeTruthy(); // CommentTreeView → CommentNodeView
  });

  it("нет записи → «не сохранена»", async () => {
    render(<SavedLectureView id="missing" />);
    expect(await screen.findByText(/не сохранена офлайн/)).toBeTruthy();
  });

  it("status saving → «ещё сохраняется»", async () => {
    await seed("l2", "saving", SNAPSHOT);
    render(<SavedLectureView id="l2" />);
    expect(await screen.findByText(/ещё сохраняется/)).toBeTruthy();
  });

  it("битый complete-снимок → «повреждён», не падает", async () => {
    await seed("bad", "complete", { foo: 1 });
    render(<SavedLectureView id="bad" />);
    expect(await screen.findByText(/повреждён/)).toBeTruthy();
  });

  it("снимок несовместимой версии схемы → «устарел», не рендерим как валидный", async () => {
    await seed("oldver", "complete", SNAPSHOT, OFFLINE_SCHEMA_VERSION + 1);
    render(<SavedLectureView id="oldver" />);
    expect(await screen.findByText(/устарел/)).toBeTruthy();
    expect(screen.queryByText("Заголовок лекции")).toBeNull();
  });

  it("ready → показывает дату сохранения и кнопку «Обновить»", async () => {
    await seed("l1", "complete", SNAPSHOT); // savedAt 2026-06-14T00:00:00.000Z
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText("Заголовок лекции")).toBeTruthy();
    expect(screen.getByText(/Сохранено офлайн/)).toBeTruthy();
    expect(screen.getByText(/14\.06\.2026/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Обновить" })).toBeTruthy();
  });

  it("«Обновить» пере-сохраняет снимок и показывает свежий контент", async () => {
    await seed("l1", "complete", SNAPSHOT);
    saveOfflineMock.mockImplementation(async () => {
      await putSavedBundle({
        entity: "lectures",
        id: "l1",
        savedAt: "2026-06-20T00:00:00.000Z",
        schemaVersion: OFFLINE_SCHEMA_VERSION,
        status: "complete",
        snapshot: {
          ...SNAPSHOT,
          lecture: { ...SNAPSHOT.lecture, title: "Обновлённый заголовок" },
        },
        imageKeys: [],
      });
      return { ok: true };
    });
    render(<SavedLectureView id="l1" />);
    await screen.findByText("Заголовок лекции");

    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));

    expect(await screen.findByText("Обновлённый заголовок")).toBeTruthy();
    expect(saveOfflineMock).toHaveBeenCalledWith("lectures", "l1");
  });

  it("«Обновить» при ошибке → инлайн-сообщение, контент не теряется", async () => {
    await seed("l1", "complete", SNAPSHOT);
    saveOfflineMock.mockResolvedValue({ ok: false, error: "нет сети" });
    render(<SavedLectureView id="l1" />);
    await screen.findByText("Заголовок лекции");

    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));

    expect(await screen.findByText(/нет сети/)).toBeTruthy();
    expect(screen.getByText("Заголовок лекции")).toBeTruthy();
  });

  it("снимок показывается до завершения сверки (сверка не блокирует показ)", async () => {
    await seed("l1", "complete", SNAPSHOT);
    // Управляемый deferred вместо вечного промиса: снимок обязан отрисоваться
    // ДО резолва сверки; release() в конце даёт эффекту завершиться чисто
    // (без act()-warning / висящего промиса при cleanup).
    let release!: () => void;
    revalidateMock.mockReturnValue(
      new Promise<"skip">((resolve) => {
        release = () => {
          resolve("skip");
        };
      }),
    );
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText("Заголовок лекции")).toBeTruthy();
    release();
  });

  it("сверка gone → плашка «удалена», кнопка «Обновить» скрыта, снимок цел", async () => {
    await seed("l1", "complete", SNAPSHOT);
    revalidateMock.mockImplementation(async () => {
      await updateSavedBundle("lectures", "l1", { remoteStatus: "gone" });
      return "gone";
    });
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText(/удалена с платформы/)).toBeTruthy();
    expect(screen.getByText("Заголовок лекции")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Обновить" })).toBeNull();
  });

  it("сверка stale → плашка «доступна обновлённая версия», кнопка видна", async () => {
    await seed("l1", "complete", SNAPSHOT);
    revalidateMock.mockImplementation(async () => {
      await updateSavedBundle("lectures", "l1", { remoteStatus: "stale" });
      return "stale";
    });
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText(/Доступна обновлённая версия/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Обновить" })).toBeTruthy();
  });

  it("офлайн → сверка не запускается", async () => {
    await seed("l1", "complete", SNAPSHOT);
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<SavedLectureView id="l1" />);
    await screen.findByText("Заголовок лекции");
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});
