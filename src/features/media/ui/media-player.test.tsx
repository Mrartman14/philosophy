import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Клиентский i18n: t(key) → key (для artist достаточно).
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import { MediaPlayer } from "./media-player";

class FakeMediaSession {
  metadata: unknown = null;
  playbackState = "none";
  setActionHandler = vi.fn();
  setPositionState = vi.fn();
}
class FakeMediaMetadata {
  title: string;
  artist: string;
  constructor(init: { title?: string; artist?: string }) {
    this.title = init.title ?? "";
    this.artist = init.artist ?? "";
  }
}

let ms: FakeMediaSession;
beforeEach(() => {
  ms = new FakeMediaSession();
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: ms,
  });
  vi.stubGlobal("MediaMetadata", FakeMediaMetadata);
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator as object, "mediaSession");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MediaPlayer + mediaSession", () => {
  it("audio: рендерит <audio>, ставит title без расширения и artist из i18n", () => {
    render(
      <MediaPlayer
        url="https://x/a.mp3"
        type="audio"
        filename="Бытие и время.mp3"
        mediaId="m1"
      />,
    );
    // RTL-query вместо container.querySelector (testing-library/no-container,
    // no-node-access — error для media-тестов). aria-label у элемента = filename.
    const el = screen.getByLabelText("Бытие и время.mp3");
    expect(el).toBeInstanceOf(HTMLAudioElement);
    expect((ms.metadata as FakeMediaMetadata).title).toBe("Бытие и время");
    // artist = t("playerArtist"); мок i18n возвращает ключ — доказывает, что
    // MediaPlayer пробрасывает i18n-строку (привязка к Task 3 Step 1).
    expect((ms.metadata as FakeMediaMetadata).artist).toBe("playerArtist");
  });

  it("video: рендерит <video>", () => {
    render(
      <MediaPlayer
        url="https://x/v.mp4"
        type="video"
        filename="lecture-1.mp4"
        mediaId="m2"
      />,
    );
    const el = screen.getByLabelText("lecture-1.mp4");
    expect(el).toBeInstanceOf(HTMLVideoElement);
    expect((ms.metadata as FakeMediaMetadata).title).toBe("lecture-1");
  });

  it("файл без расширения — title как есть", () => {
    render(
      <MediaPlayer url="https://x/a" type="audio" filename="lecture" mediaId="m3" />,
    );
    expect((ms.metadata as FakeMediaMetadata).title).toBe("lecture");
    // sanity: компонент отрендерился
    expect(screen.getByLabelText("lecture")).toBeTruthy();
  });
});
