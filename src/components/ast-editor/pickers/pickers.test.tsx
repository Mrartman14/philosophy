import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      };
    },
  };
});

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import * as actions from "./actions";
import { CanvasPicker } from "./canvas-picker";
import { CommentPicker } from "./comment-picker";
import { DocumentPicker } from "./document-picker";
import { GlossaryPicker } from "./glossary-picker";
import { LecturePicker } from "./lecture-picker";
import { MediaPicker } from "./media-picker";

const mocked = actions as unknown as {
  searchLectures: ReturnType<typeof vi.fn>;
  searchGlossary: ReturnType<typeof vi.fn>;
  searchDocuments: ReturnType<typeof vi.fn>;
  searchCanvases: ReturnType<typeof vi.fn>;
  searchMedia: ReturnType<typeof vi.fn>;
  searchCommentsByLecture: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LecturePicker", () => {
  it("calls searchLectures with q and renders titles", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "Античность" }],
      total: 1,
    });
    render(<LecturePicker onSelect={() => undefined} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Ан" } });
    await waitFor(
      () => {
        const lastCall = mocked.searchLectures.mock.calls.at(-1);
        if (lastCall === undefined) throw new Error("searchLectures не был вызван");
        expect(lastCall[0]).toBe("Ан");
      },
      { timeout: 600 },
    );
    expect(await screen.findByText("Античность")).toBeInTheDocument();
  });
});

describe("GlossaryPicker", () => {
  it("calls searchGlossary and renders titles, propagates id+label on select", async () => {
    mocked.searchGlossary.mockResolvedValue({
      data: [{ id: "g1", title: "Эйдос" }],
      total: 1,
    });
    const onSelect = vi.fn();
    render(<GlossaryPicker onSelect={onSelect} />);
    await screen.findByText("Эйдос");
    expect(mocked.searchGlossary).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Эйдос"));
    expect(onSelect).toHaveBeenCalledWith("g1", "Эйдос");
  });
});

describe("DocumentPicker", () => {
  it("calls searchDocuments and renders filenames, propagates id+label on select", async () => {
    mocked.searchDocuments.mockResolvedValue({
      data: [{ id: "d1", filename: "essay.pdf" }],
      total: 1,
    });
    const onSelect = vi.fn();
    render(<DocumentPicker onSelect={onSelect} />);
    await screen.findByText("essay.pdf");
    fireEvent.click(screen.getByText("essay.pdf"));
    expect(onSelect).toHaveBeenCalledWith("d1", "essay.pdf");
  });
});

describe("CanvasPicker", () => {
  it("calls searchCanvases and renders titles, propagates id+label on select", async () => {
    mocked.searchCanvases.mockResolvedValue({
      data: [{ id: "cv1", title: "Дерево понятий" }],
      total: 1,
    });
    const onSelect = vi.fn();
    render(<CanvasPicker onSelect={onSelect} />);
    await screen.findByText("Дерево понятий");
    fireEvent.click(screen.getByText("Дерево понятий"));
    expect(onSelect).toHaveBeenCalledWith("cv1", "Дерево понятий");
  });
});

describe("CommentPicker", () => {
  it("calls searchCommentsByLecture with lectureId and renders snippets", async () => {
    mocked.searchCommentsByLecture.mockResolvedValue({
      data: [{ id: "c1", snippet: "интересная мысль" }],
      total: 1,
    });
    const onSelect = vi.fn();
    render(<CommentPicker lectureId="L42" onSelect={onSelect} />);
    await screen.findByText("интересная мысль");
    expect(mocked.searchCommentsByLecture).toHaveBeenCalled();
    const firstCall = mocked.searchCommentsByLecture.mock.calls[0];
    if (firstCall === undefined) throw new Error("searchCommentsByLecture не был вызван");
    expect(firstCall[0]).toBe("L42");
    fireEvent.click(screen.getByText("интересная мысль"));
    expect(onSelect).toHaveBeenCalledWith("c1", "интересная мысль");
  });
});

describe("MediaPicker", () => {
  it("type=video radio triggers searchMedia with type=video", async () => {
    mocked.searchMedia.mockResolvedValue({
      data: [{ id: "m1", filename: "lecture.mp4" }],
      total: 1,
    });
    render(<MediaPicker onSelect={() => undefined} />);
    fireEvent.click(screen.getByLabelText(/видео/i));
    await waitFor(
      () => {
        const lastCall = mocked.searchMedia.mock.calls.at(-1);
        expect(lastCall?.[3]).toBe("video");
      },
      { timeout: 600 },
    );
  });
});
