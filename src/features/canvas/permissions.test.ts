// src/features/canvas/permissions.test.ts
import { describe, it, expect } from "vitest";

import type { MaybeMe } from "@/utils/me";

import {
  canCreateCanvas,
  canEditCanvas,
  canChangeVisibility,
  canDeleteCanvas,
  canSeeRevisions,
} from "./permissions";
import type { Canvas } from "./types";

function me(over: Partial<NonNullable<MaybeMe>> = {}): NonNullable<MaybeMe> {
  return { id: "u1", username: "u", role: "user", status: "active", capabilities: [], ...over };
}
function canvas(over: Partial<Canvas> = {}): Canvas {
  return { id: "c1", owner: { id: "u1" }, visibility: "private", title: "T", ...over };
}

describe("canCreateCanvas", () => {
  it("гость → false", () => { expect(canCreateCanvas(null)).toBe(false); });
  it("есть canvas.create → true", () => { expect(canCreateCanvas(me({ capabilities: ["canvas.create"] }))).toBe(true); });
  it("нет capability → false", () => { expect(canCreateCanvas(me())).toBe(false); });
  it("suspended с canvas.create → false", () => { expect(canCreateCanvas(me({ status: "suspended", capabilities: ["canvas.create"] }))).toBe(false); });
});

describe("canEditCanvas", () => {
  it("гость → false", () => { expect(canEditCanvas(null, canvas())).toBe(false); });
  it("владелец → true", () => { expect(canEditCanvas(me({ id: "u1" }), canvas({ owner: { id: "u1" } }))).toBe(true); });
  it("не владелец → false", () => { expect(canEditCanvas(me({ id: "u2" }), canvas({ owner: { id: "u1" } }))).toBe(false); });
  it("владелец suspended → false", () => { expect(canEditCanvas(me({ id: "u1", status: "suspended" }), canvas({ owner: { id: "u1" } }))).toBe(false); });
});

describe("canChangeVisibility", () => {
  it("гость → false", () => { expect(canChangeVisibility(null, canvas())).toBe(false); });
  it("владелец приватного → true", () => { expect(canChangeVisibility(me({ id: "u1" }), canvas({ owner: { id: "u1" }, visibility: "private" }))).toBe(true); });
  it("владелец публичного → false (downgrade запрещён)", () => { expect(canChangeVisibility(me({ id: "u1" }), canvas({ owner: { id: "u1" }, visibility: "public" }))).toBe(false); });
  it("не владелец приватного → false", () => { expect(canChangeVisibility(me({ id: "u2" }), canvas({ owner: { id: "u1" }, visibility: "private" }))).toBe(false); });
});

describe("canDeleteCanvas", () => {
  it("гость → false", () => { expect(canDeleteCanvas(null, canvas())).toBe(false); });
  it("владелец приватного → true", () => { expect(canDeleteCanvas(me({ id: "u1" }), canvas({ owner: { id: "u1" }, visibility: "private" }))).toBe(true); });
  it("admin с delete_any на публичном чужом → true", () => { expect(canDeleteCanvas(me({ id: "adm", capabilities: ["canvas.delete_any"] }), canvas({ owner: { id: "u1" }, visibility: "public" }))).toBe(true); });
  it("admin с delete_any на приватном чужом → false", () => { expect(canDeleteCanvas(me({ id: "adm", capabilities: ["canvas.delete_any"] }), canvas({ owner: { id: "u1" }, visibility: "private" }))).toBe(false); });
  it("чужой без delete_any → false", () => { expect(canDeleteCanvas(me({ id: "u2" }), canvas({ owner: { id: "u1" }, visibility: "public" }))).toBe(false); });
});

describe("canSeeRevisions", () => {
  it("public → true", () => { expect(canSeeRevisions(canvas({ visibility: "public" }))).toBe(true); });
  it("private → false", () => { expect(canSeeRevisions(canvas({ visibility: "private" }))).toBe(false); });
});
