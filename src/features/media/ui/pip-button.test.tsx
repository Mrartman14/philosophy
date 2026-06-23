import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line import/order -- usePictureInPicture импортируется до vi.mock для vi.mocked-ссылки; SUT (pip-button) грузится ниже после моков
import { usePictureInPicture } from "./use-picture-in-picture";

vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("./use-picture-in-picture", () => ({
  usePictureInPicture: vi.fn(),
}));

// eslint-disable-next-line import/order -- SUT импортируется после vi.mock, чтобы usePictureInPicture был замокан до загрузки модуля
import { PipButton } from "./pip-button";

const mockHook = vi.mocked(usePictureInPicture);

function setHook(v: { supported: boolean; active: boolean; toggle: () => void }) {
  mockHook.mockReturnValue(v);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ref = { current: null };

describe("PipButton", () => {
  it("не рендерится без поддержки PiP", () => {
    setHook({ supported: false, active: false, toggle: vi.fn() });
    render(<PipButton videoRef={ref} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("рендерит кнопку при поддержке; aria-label 'pipEnter' когда не активно", () => {
    setHook({ supported: true, active: false, toggle: vi.fn() });
    render(<PipButton videoRef={ref} />);
    expect(screen.getByRole("button", { name: "pipEnter" })).toBeTruthy();
  });

  it("aria-label 'pipExit' когда активно", () => {
    setHook({ supported: true, active: true, toggle: vi.fn() });
    render(<PipButton videoRef={ref} />);
    expect(screen.getByRole("button", { name: "pipExit" })).toBeTruthy();
  });

  it("клик зовёт toggle", () => {
    const toggle = vi.fn();
    setHook({ supported: true, active: false, toggle });
    render(<PipButton videoRef={ref} />);
    fireEvent.click(screen.getByRole("button"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
