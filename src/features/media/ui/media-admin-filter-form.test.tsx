// src/features/media/ui/media-admin-filter-form.test.tsx
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/media",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import { MediaAdminFilterForm } from "./media-admin-filter-form";

beforeEach(() => {
  replace.mockClear();
});
afterEach(cleanup);

describe("MediaAdminFilterForm", () => {
  it("submit с непустым owner_id → router.replace c ?owner_id и без offset", () => {
    render(<MediaAdminFilterForm />);
    const input = screen.getByLabelText("mediaFilterOwnerLabel");
    fireEvent.change(input, { target: { value: "u-42" } });
    fireEvent.click(screen.getByText("mediaFilterApply"));

    expect(replace).toHaveBeenCalledWith("/admin/media?owner_id=u-42");
  });

  it("сброс → router.replace на чистый путь (без query)", () => {
    render(<MediaAdminFilterForm />);
    fireEvent.click(screen.getByText("mediaFilterClear"));

    expect(replace).toHaveBeenCalledWith("/admin/media");
  });
});
