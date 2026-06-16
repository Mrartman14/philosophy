/**
 * RBAC-denied path tests for users/actions.ts.
 *
 * Strategy:
 * - Use REAL permissions.ts (NOT mocked) — this is what makes the gate real.
 * - Stub getMe to a user that LACKS the required capability.
 * - Stub createApiClient so mutating verbs (PUT) are spies.
 * - Each test asserts BOTH {success:false,code:"forbidden"} AND spy.not.called.
 *
 * Gate breakdown per action:
 *   setUserRole    → requireCapability(me, canModerateUsers) [user.moderate cap]
 *   setUserStatus  → requireCapability(me, canModerateUsers) [user.moderate cap]
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeUserNoCapsMe } from "@/test/action-rbac";

// ── Mutating verb spy ─────────────────────────────────────────────────────────
const put = vi.fn();

// ── Module-level mocks (hoisted by vitest) ────────────────────────────────────

// NOTE: We do NOT mock "./permissions" — we want the REAL permission helpers.

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// next/navigation — createAction may use redirect
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

// Import actions AFTER vi.mock (hoisted ordering).
import { setUserRole, setUserStatus } from "./actions";

// ── Test constants ────────────────────────────────────────────────────────────
const TARGET_USER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

beforeEach(() => {
  put.mockReset();
  getMeImpl.mockReset();
});

// ── setUserRole: capability-only (user.moderate) ──────────────────────────────

describe("setUserRole — RBAC denied", () => {
  it("guest → forbidden, PUT not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await setUserRole({ id: TARGET_USER_ID, role: "user" });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(put).not.toHaveBeenCalled();
  });

  it("active user without user.moderate → forbidden, PUT not called", async () => {
    getMeImpl.mockResolvedValue(activeUserNoCapsMe());
    const result = await setUserRole({ id: TARGET_USER_ID, role: "admin" });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(put).not.toHaveBeenCalled();
  });
});

// ── setUserStatus: capability-only (user.moderate) ───────────────────────────

describe("setUserStatus — RBAC denied", () => {
  it("guest → forbidden, PUT not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await setUserStatus({ id: TARGET_USER_ID, status: "suspended" });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(put).not.toHaveBeenCalled();
  });

  it("active user without user.moderate → forbidden, PUT not called", async () => {
    getMeImpl.mockResolvedValue(activeUserNoCapsMe());
    const result = await setUserStatus({ id: TARGET_USER_ID, status: "active" });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(put).not.toHaveBeenCalled();
  });
});

// ── Self-check: admin with user.moderate IS allowed ──────────────────────────

describe("setUserRole — moderator is ALLOWED (gate sanity)", () => {
  it("admin user with user.moderate cap → gate passes, PUT called", async () => {
    const adminMe: import("@/utils/me").Me = {
      id: "admin-id",
      username: "admin",
      role: "admin",
      status: "active",
      capabilities: ["user.moderate"],
    };
    getMeImpl.mockResolvedValue(adminMe);
    put.mockResolvedValue({
      data: { data: { id: TARGET_USER_ID, role: "user" } },
      error: undefined,
    });
    const result = await setUserRole({ id: TARGET_USER_ID, role: "user" });
    expect(result).not.toMatchObject({ code: "forbidden" });
    expect(put).toHaveBeenCalledOnce();
  });
});
