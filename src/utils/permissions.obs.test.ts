import { describe, it, expect, beforeEach } from "vitest";

import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
import { setSink } from "@/services/observability/core/registry";

import type { Me } from "./me";
import { requireActive, requireCapability, ForbiddenError } from "./permissions";

const mem = createMemorySink();

beforeEach(() => {
  mem.clear();
  setSink(mem.sink);
});

function denied() {
  return mem.records.filter((r) => r.kind === "metric" && r.metric === "rbac.denied");
}

const activeMe: Me = {
  id: "u1",
  username: "ann",
  role: "user",
  status: "active",
  capabilities: [],
};

describe("rbac.denied metric", () => {
  it("guest deny → rbac.denied{reason:guest}", () => {
    expect(() => { requireCapability(null, () => false); }).toThrow(ForbiddenError);
    expect(denied()[0]?.attributes).toMatchObject({ reason: "guest" });
  });

  it("role deny (active без cap) → rbac.denied{reason:role}", () => {
    expect(() => { requireCapability(activeMe, () => false); }).toThrow(ForbiddenError);
    expect(denied()[0]?.attributes).toMatchObject({ reason: "role" });
  });

  it("suspended deny → rbac.denied{reason:status}", () => {
    const suspended: Me = { ...activeMe, status: "suspended" };
    expect(() => { requireActive(suspended); }).toThrow(ForbiddenError);
    expect(denied()[0]?.attributes).toMatchObject({ reason: "status" });
  });

  it("success path не эмитит rbac.denied", () => {
    requireActive(activeMe);
    expect(denied()).toHaveLength(0);
  });
});
