import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { FOCUS_RING_CONTROL } from "@/components/ui";

import type { MediaListItem } from "../types";

// Мок @/i18n: getT("media") возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n", async () => {
  const { default: media } = await import("@/i18n/messages/ru/media");
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = media;
        for (const part of parts) {
          val = val?.[part];
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      }),
  };
});

import { MediaCard } from "./media-card";

afterEach(cleanup);

const media: MediaListItem = {
  created_at: "2026-06-22T00:00:00Z",
  filename: "lecture-1.mp4",
  id: "m1",
  owner: { id: "owner-1" },
  type: "video",
  visibility: "public",
};

describe("MediaCard focus appearance", () => {
  it("карточка-ссылка несёт focus-visible-кольцо kit (WCAG 2.4.7)", async () => {
    render(await MediaCard({ media }));
    const link = screen.getByRole("link");
    expect(link.className).toContain(FOCUS_RING_CONTROL);
  });

  it("не глушит индикатор фокуса (нет outline-0)", async () => {
    render(await MediaCard({ media }));
    const link = screen.getByRole("link");
    expect(link.className).not.toMatch(/\boutline-0\b/);
  });
});
