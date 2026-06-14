import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import * as actions from "./actions";
import { LecturePicker } from "./lecture-picker";
import { GlossaryPicker } from "./glossary-picker";
import { DocumentPicker } from "./document-picker";
import { CanvasPicker } from "./canvas-picker";
import { MediaPicker } from "./media-picker";
import { CommentPicker } from "./comment-picker";
import { Comment2StagePicker } from "./comment-2stage-picker";

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
    fireEvent.mouseDown(screen.getByText("Эйдос"));
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
    fireEvent.mouseDown(screen.getByText("essay.pdf"));
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
    fireEvent.mouseDown(screen.getByText("Дерево понятий"));
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
    fireEvent.mouseDown(screen.getByText("интересная мысль"));
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

describe("Comment2StagePicker", () => {
  it("starts at step 1 without defaultLectureId, advances on select", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    mocked.searchCommentsByLecture.mockResolvedValue({
      data: [{ id: "c1", snippet: "hi" }],
      total: 1,
    });
    const onSelect = vi.fn();
    render(<Comment2StagePicker onSelect={onSelect} />);
    expect(screen.getByText(/шаг 1/i)).toBeInTheDocument();
    fireEvent.mouseDown(await screen.findByText("L1"));
    await screen.findByText(/шаг 2/i);
    fireEvent.mouseDown(await screen.findByText("hi"));
    expect(onSelect).toHaveBeenCalledWith("c1", "hi");
  });

  it("starts at step 2 with defaultLectureId, back returns to step 1", async () => {
    mocked.searchCommentsByLecture.mockResolvedValue({ data: [], total: 0 });
    mocked.searchLectures.mockResolvedValue({ data: [], total: 0 });
    render(<Comment2StagePicker defaultLectureId="L0" onSelect={() => undefined} />);
    await screen.findByText(/шаг 2/i);
    fireEvent.click(screen.getByRole("button", { name: /сменить лекцию/i }));
    expect(await screen.findByText(/шаг 1/i)).toBeInTheDocument();
  });
});
