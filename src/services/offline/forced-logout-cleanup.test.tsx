import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const { wipeMock, clearOwnerMock } = vi.hoisted(() => ({
  wipeMock: vi.fn(),
  clearOwnerMock: vi.fn(),
}));
vi.mock("./wipe", () => ({ wipeOfflineData: wipeMock }));
vi.mock("./owner", () => ({ clearOfflineOwner: clearOwnerMock }));

import { ForcedLogoutCleanup } from "./forced-logout-cleanup";

beforeEach(() => {
  wipeMock.mockReset().mockResolvedValue(true);
  clearOwnerMock.mockReset();
});
afterEach(cleanup);

describe("ForcedLogoutCleanup", () => {
  it("на mount стирает офлайн-данные и маркер владельца", async () => {
    const { container } = render(<ForcedLogoutCleanup />);
    await waitFor(() => expect(wipeMock).toHaveBeenCalledOnce());
    expect(clearOwnerMock).toHaveBeenCalledOnce();
    expect(container).toBeEmptyDOMElement();
  });
});
