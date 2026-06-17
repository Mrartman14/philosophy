import { describe, it, expect, vi, beforeEach } from "vitest";

import { M } from "@/services/observability/core/names";

import { revalidateEntity } from "./revalidate";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...a: unknown[]): unknown => revalidateTag(...a),
}));

const increment = vi.fn();
vi.mock("@/services/observability/core/facade", () => ({
  metrics: { increment: (...a: unknown[]): unknown => increment(...a) },
}));

describe("revalidateEntity", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    increment.mockClear();
  });

  it("increments mutation.commit{entity} and revalidates list tag", () => {
    revalidateEntity("documents");
    expect(increment).toHaveBeenCalledWith(M.mutationCommit, { entity: "documents" });
    expect(revalidateTag).toHaveBeenCalledWith("documents", "default");
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });

  it("also revalidates item tag when id is given (single mutation count)", () => {
    revalidateEntity("documents", "d1");
    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment).toHaveBeenCalledWith(M.mutationCommit, { entity: "documents" });
    expect(revalidateTag).toHaveBeenCalledWith("documents:d1", "default");
  });
});
