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
import { MediaPicker } from "./media-picker";
import { Comment2StagePicker } from "./comment-2stage-picker";

const mocked = actions as unknown as {
  searchLectures: ReturnType<typeof vi.fn>;
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
        const lastCall = mocked.searchLectures.mock.calls.at(-1)!;
        expect(lastCall[0]).toBe("Ан");
      },
      { timeout: 600 },
    );
    expect(await screen.findByText("Античность")).toBeInTheDocument();
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
    expect(onSelect).toHaveBeenCalledWith("c1");
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
