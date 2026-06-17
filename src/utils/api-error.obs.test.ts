import { describe, it, expect } from "vitest";

import { withMemorySink } from "@/test/observability";

import { rethrowApiError } from "./api-error";

const { records } = withMemorySink();

describe("rethrowApiError observability", () => {
  it("эмитит backend.error{code} перед throw для маппленного кода", () => {
    expect(() => rethrowApiError({ code: "VERSION_MISMATCH" })).toThrow();
    const m = records.filter(
      (r) => r.kind === "metric" && r.metric === "backend.error",
    );
    expect(m).toHaveLength(1);
    expect(m[0]?.attributes).toMatchObject({ code: "VERSION_MISMATCH" });
    // маппленный код НЕ должен попадать в error-capture
    expect(records.some((r) => r.kind === "error")).toBe(false);
  });

  it("captures unmapped код как unexpected с reason=unmapped_backend_code", () => {
    expect(() =>
      rethrowApiError({ code: "TOTALLY_UNKNOWN_CODE" as never }),
    ).toThrow();
    const errs = records.filter((r) => r.kind === "error");
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({
      kind: "error",
      errorClass: "unexpected",
      backendCode: "TOTALLY_UNKNOWN_CODE",
      handled: true,
    });
    expect(errs[0]?.attributes).toMatchObject({
      reason: "unmapped_backend_code",
    });
  });
});
