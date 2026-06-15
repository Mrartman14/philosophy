// src/app/saved/saved-list.test.tsx
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, it, expect } from "vitest";

import { putSavedBundle, getSavedBundle } from "@/services/offline/store/saved-bundles";

import { SavedList } from "./saved-list";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
afterEach(cleanup);

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

describe("SavedList", () => {
  it("показывает complete-лекции со ссылкой на /saved/[id]", async () => {
    await seed("l1", "complete", { lecture: { title: "Лекция один" }, tags: [], documents: [], comments: [] });
    render(<SavedList />);
    const link = await screen.findByRole("link", { name: "Лекция один" });
    expect(link.getAttribute("href")).toBe("/saved/l1");
  });

  it("подметает зависшие saving→error и не показывает их", async () => {
    await seed("l2", "saving", { lecture: { title: "Недосохранённая" }, tags: [], documents: [], comments: [] });
    render(<SavedList />);
    await waitFor(async () => {
      const rec = await getSavedBundle("lectures", "l2");
      expect(rec?.status).toBe("error");
    });
    expect(screen.queryByText("Недосохранённая")).toBeNull();
  });

  it("битый complete-снимок (без lecture.title) не валит список", async () => {
    await seed("bad", "complete", { documents: [], comments: [] });
    await seed("ok", "complete", { lecture: { title: "Норм" }, tags: [], documents: [], comments: [] });
    render(<SavedList />);
    expect(await screen.findByText("Норм")).toBeTruthy();
  });

  it("пусто → подсказка", async () => {
    render(<SavedList />);
    expect(await screen.findByText(/Пока ничего не сохранено/)).toBeTruthy();
  });
});
