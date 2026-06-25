import { describe, it, expect, vi, beforeEach } from "vitest";

import { M } from "@/services/observability/core/names";

import { revalidateEntity } from "./revalidate";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  updateTag: (...a: unknown[]): unknown => updateTag(...a),
}));

const increment = vi.fn();
vi.mock("@/services/observability", async (importActual) => {
  const actual = await importActual<typeof import("@/services/observability")>();
  return {
    ...actual,
    metrics: { increment: (...a: unknown[]): unknown => increment(...a) },
  };
});

describe("revalidateEntity", () => {
  beforeEach(() => {
    updateTag.mockClear();
    increment.mockClear();
  });

  // updateTag (а не revalidateTag(tag, profile)) — чтобы автор мутации сразу
  // увидел свою запись: updateTag помечает текущий маршрут как ревалидированный
  // (read-your-writes), revalidateTag с профилем даёт лишь stale-while-revalidate.
  it("increments mutation.commit{entity} and updates list tag (read-your-writes)", () => {
    revalidateEntity("documents");
    expect(increment).toHaveBeenCalledWith(M.mutationCommit, { entity: "documents" });
    expect(updateTag).toHaveBeenCalledWith("documents");
    expect(updateTag).toHaveBeenCalledTimes(1);
  });

  it("also updates item tag when id is given (single mutation count)", () => {
    revalidateEntity("documents", "d1");
    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment).toHaveBeenCalledWith(M.mutationCommit, { entity: "documents" });
    expect(updateTag).toHaveBeenCalledWith("documents:d1");
  });
});
