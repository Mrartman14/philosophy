/**
 * Shared helpers for RBAC-denied path tests on server actions.
 *
 * USAGE PATTERN in each test file:
 *  1. vi.mock("@/utils/me", ...) — stub getMe to return guestMe() or suspendedMe()
 *  2. vi.mock("@/api/client", ...) — stub createApiClient with spy verbs
 *  3. Do NOT vi.mock("./permissions") — use REAL permission helpers (this is the gap we test)
 *  4. Use expectDenied() to verify the action returned {success:false,code:"forbidden"}
 *     AND no mutating API verb was called.
 */

import { expect } from "vitest";

import type { Me } from "@/utils/me";

// ── Me builders ──────────────────────────────────────────────────────────────

/** Returns null — i.e. a guest (unauthenticated). requireCapability throws "guest". */
export function guestMe(): null {
  return null;
}

/**
 * Active user with NO capabilities ("user" role, no special caps).
 * canCreateLecture / canDeleteLecture / canModerateUsers etc. → false.
 * Owner-aware helpers can still return true if id matches — use otherUserMe() for those.
 */
export function activeUserNoCapsMe(id = "user-no-caps-id"): Me {
  return {
    id,
    username: "user-no-caps",
    role: "user",
    status: "active",
    capabilities: [],
  };
}

/**
 * Suspended user — passes isMutationAllowed? No: status !== "active" → false.
 * requireActive() throws ForbiddenError("status"). Useful for requireActive-gated actions.
 */
export function suspendedMe(id = "suspended-user-id"): Me {
  return {
    id,
    username: "suspended-user",
    role: "user",
    status: "suspended",
    capabilities: [],
  };
}

/**
 * Active user whose ID does NOT match the resource's owner_id.
 * Owner-aware predicates (canUpdateLecture, canManageCover, …) → false.
 */
export function otherUserActiveMe(id = "other-user-id"): Me {
  return {
    id,
    username: "other-user",
    role: "user",
    status: "active",
    capabilities: [],
  };
}

// ── Lecture stubs ─────────────────────────────────────────────────────────────

/**
 * Minimal stub of a Lecture owned by a user OTHER than the one returned by
 * otherUserActiveMe(). Used to set up owner-aware gate rejections.
 */
export function lectureOwnedByOther(
  id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ownerId = "real-owner-id",
) {
  return {
    id,
    owner_id: ownerId,
    title: "Test Lecture",
    description: "",
    date: "2024-01-01",
    visibility: "private" as const,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

// ── Assertion helper ──────────────────────────────────────────────────────────

/**
 * Expects:
 *  1. The action result has {success: false, code: "forbidden"}.
 *  2. None of the provided mutating API verb spies were called.
 *
 * Named `expectDenied` (starts with "expect") so the vitest/expect-expect ESLint
 * rule recognises it as an assertion function.
 *
 * @param result  The ActionResult returned by the server action.
 * @param mutatingSpies  The vi.fn() spies for POST/PUT/PATCH/DELETE on the mock client.
 */
export function expectDenied(
  result: unknown,
  mutatingSpies: { mock: { calls: unknown[] } }[],
): void {
  expect(result).toMatchObject({ success: false, code: "forbidden" });
  for (const spy of mutatingSpies) {
    expect(spy.mock.calls.length).toBe(0);
  }
}
