// src/app/saved/saved-lecture-view.test.tsx
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, it, expect } from "vitest";

import { putSavedBundle } from "@/services/offline/store/saved-bundles";

import { SavedLectureView } from "./saved-lecture-view";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
afterEach(cleanup);

// Снимок хранится как unknown → литерал не обязан удовлетворять полным типам.
const SNAPSHOT = {
  lecture: {
    id: "l1",
    title: "Заголовок лекции",
    date: "2026-01-01",
    description: "Описание лекции",
    owner_id: "o",
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
        user_id: "u",
        lecture_id: "l1",
        type: "claim",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        author: { username: "alice" },
        blocks: [],
      },
      descendants: [],
    },
  ],
};

function seed(id: string, status: "complete" | "saving", snapshot: unknown) {
  return putSavedBundle({
    entity: "lectures",
    id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion: 1,
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
});
