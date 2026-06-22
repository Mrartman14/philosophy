// src/features/media/ui/media-admin-row.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import type { AdminMediaItem } from "../types";

import { MediaAdminRow } from "./media-admin-row";

// getT/getServerFmt — серверные i18n-хелперы. Стабим детерминированно.
vi.mock("@/i18n", () => ({
  getT: () =>
    Promise.resolve((key: string) => {
      const dict: Record<string, string> = {
        typeVideo: "Видео",
        typeAudio: "Аудио",
        statusPublic: "Опубликовано",
        statusPrivate: "Приватно",
        mediaOwnerLabel: "Автор",
      };
      return dict[key] ?? key;
    }),
  getServerFmt: () =>
    Promise.resolve({ dateTime: () => "01.06.2026" }),
}));

// MediaDeleteButton — client-компонент с зависимостями (toast/router). Стабим.
vi.mock("./media-delete-button", () => ({
  MediaDeleteButton: ({ id, isAdminDelete }: { id: string; isAdminDelete?: boolean }) => (
    <button data-testid="del" data-id={id} data-admin={String(!!isAdminDelete)}>
      del
    </button>
  ),
}));

const media: AdminMediaItem = {
  id: "m-1",
  filename: "lecture-intro.mp4",
  type: "video",
  owner_id: "owner-uuid-7",
  owner_username: "ivan",
  visibility: "public",
  created_at: "2026-06-01T10:00:00Z",
};

afterEach(cleanup);

describe("MediaAdminRow", () => {
  it("показывает filename, владельца, тип, visibility и кнопку admin-удаления", async () => {
    render(await MediaAdminRow({ media }));

    expect(screen.getByText("lecture-intro.mp4")).toBeInTheDocument();
    expect(screen.getByText("ivan")).toBeInTheDocument();
    expect(screen.getByText("Видео")).toBeInTheDocument();
    expect(screen.getByText("Опубликовано")).toBeInTheDocument();

    const btn = screen.getByTestId("del");
    expect(btn).toHaveAttribute("data-id", "m-1");
    expect(btn).toHaveAttribute("data-admin", "true");
  });

  it("показывает owner_username когда он есть", async () => {
    render(await MediaAdminRow({ media }));
    expect(screen.getByText("ivan")).toBeInTheDocument();
    // owner_id не должен показываться как текст, когда есть username
    expect(screen.queryByText("owner-uuid-7")).not.toBeInTheDocument();
  });

  it("фолбэк на owner_id когда owner_username отсутствует", async () => {
    const { owner_username: _omit, ...noUsername } = media;
    render(await MediaAdminRow({ media: noUsername }));
    expect(screen.getByText("owner-uuid-7")).toBeInTheDocument();
  });

  it("приватное медиа → бейдж 'Приватно'", async () => {
    render(await MediaAdminRow({ media: { ...media, visibility: "private" } }));
    expect(screen.getByText("Приватно")).toBeInTheDocument();
  });
});
