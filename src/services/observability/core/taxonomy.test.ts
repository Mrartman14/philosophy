// src/services/observability/core/taxonomy.test.ts
import { describe, it, expect } from "vitest";

import { classifyError } from "./taxonomy";

describe("classifyError", () => {
  it("forbidden + reason='role' → forbidden.role, backendCode='forbidden'", () => {
    expect(classifyError({ code: "forbidden", reason: "role" })).toEqual({
      errorClass: "forbidden.role",
      backendCode: "forbidden",
    });
  });

  it("forbidden без reason → forbidden.role по умолчанию", () => {
    expect(classifyError({ code: "forbidden" })).toEqual({
      errorClass: "forbidden.role",
      backendCode: "forbidden",
    });
  });

  it("forbidden + reason='owner' → forbidden.owner", () => {
    expect(classifyError({ code: "forbidden", reason: "owner" }).errorClass).toBe(
      "forbidden.owner",
    );
  });

  it("banned → banned", () => {
    expect(classifyError({ code: "banned" })).toEqual({
      errorClass: "banned",
      backendCode: "banned",
    });
  });

  it("validation → validation", () => {
    expect(classifyError({ code: "validation" })).toEqual({
      errorClass: "validation",
      backendCode: "validation",
    });
  });

  it("TypeError → network", () => {
    expect(classifyError(new TypeError("boom"))).toEqual({
      errorClass: "network",
      backendCode: null,
    });
  });

  it("Error 'fetch failed' → network", () => {
    expect(classifyError(new Error("fetch failed")).errorClass).toBe("network");
  });

  it("сообщение содержит 'network' → network", () => {
    expect(classifyError(new Error("network down")).errorClass).toBe("network");
  });

  it("прочее → unexpected, backendCode=null", () => {
    expect(classifyError(new Error("weird"))).toEqual({
      errorClass: "unexpected",
      backendCode: null,
    });
  });

  it("не-объект (string) → unexpected", () => {
    expect(classifyError("oops")).toEqual({
      errorClass: "unexpected",
      backendCode: null,
    });
  });
});
