/**
 * Shared Me/resource builders for RBAC-denied path tests on server actions.
 *
 * USAGE PATTERN in each test file:
 *  1. vi.mock("@/utils/me", ...) — stub getMe to return null (guest),
 *     suspendedMe(), activeUserNoCapsMe() or otherUserActiveMe()
 *  2. vi.mock("@/api/client", ...) — stub createApiClient with spy verbs
 *  3. Do NOT vi.mock("./permissions") — use REAL permission helpers (this is the gap we test)
 *  4. Each test asserts {success:false,code:"forbidden"} AND that no mutating
 *     API verb spy was called.
 */

import type { Me } from "@/utils/me";

// ── Me builders ──────────────────────────────────────────────────────────────

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
