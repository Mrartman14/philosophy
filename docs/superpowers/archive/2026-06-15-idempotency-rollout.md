# Idempotency Rollout (all backend-supported endpoints) — Implementation Plan

> **For agentic workers:** apply the documented pattern (`docs/frontend-conventions.md §3.4.1`) to every remaining endpoint the backend covers with `Idempotency-Key`. Reference adopter already shipped: `createComment`. Steps use `- [ ]` checkboxes.

**Goal:** Forward `Idempotency-Key` from the frontend on ALL 27 backend endpoints that declare it (currently only 1/27 wired online).

**Architecture:** Group A (form actions) reuse the shipped pattern (`<IdempotencyField result={state}/>` + `ctx` + `idempotencyHeaders`). Group B (annotation create) uses the direct-`fetch` spread. Group C (imperative `createAction`) gets a new symmetric foundation: `createAction`'s returned function accepts an optional trailing `idempotencyKey`, passed to the handler via a `{ idempotencyKey }` context — mirroring `createFormAction` — plus a client `useIdempotencyKey()` hook for buttons.

**Tech Stack:** Next.js server actions, openapi-fetch, React `useActionState`/imperative actions, Vitest.

---

## Execution rules
- **Work directly on `main`** (user's standing choice for this project). Push is blocked in settings — local commits only.
- **Parallel-agent git rules:** NEVER destructive git / `--amend` / `git add -A`. Stage only each slice's own files by name. Other agents' working-tree files (`public/sw.js`, `src/api/schema.ts`, `.env.development.local`) — never touch.
- **Sequential execution** (one slice at a time) to avoid concurrent-git index races on the shared repo.
- Each slice: apply pattern → `pnpm lint` + `pnpm typecheck` + run the slice's tests → commit own files. Preserve each slice's existing `rethrowApiError(error, ERRORS)` override argument.
- Final: one holistic review + full gate (`pnpm lint && pnpm test && pnpm build`).
- **Skip endpoints already wired:** `POST /api/lectures/{id}/comments` (`createComment`).

## The pattern (Group A — form actions, `createFormAction`)
For each action+form pair:
1. Form (`"use client"`): add `IdempotencyField` to the `@/components/ui` import (alphabetical) and render `<IdempotencyField result={state} />` inside `<Form>` next to hidden fields (`state` from `useActionState`).
2. Action: add `import { idempotencyHeaders } from "@/utils/idempotency";` (correct import order); add `ctx` as the 2nd handler arg; add `headers: idempotencyHeaders(ctx.idempotencyKey)` to the `api.{POST,PUT}` options. KEEP the existing `rethrowApiError(error, ERRORS)` second argument.

## Endpoint → action → file map (from audit)

### Group A — form actions (createFormAction)
| Slice | Action | Endpoint | Form file |
|---|---|---|---|
| banners | `createBanner` | POST /api/admin/banners | banner form |
| banners | `updateBanner` | PUT /api/admin/banners/{id} | banner form |
| events | `createEvent` | POST /api/admin/events | event form |
| events | `updateEvent` | PUT /api/admin/events/{id} | event form |
| glossary | `createTerm` | POST /api/admin/glossary | term form |
| glossary | `updateTermBlocks` | PUT /api/admin/glossary/{id}/blocks | term form |
| lectures | `createLecture` | POST /api/admin/lectures | lecture form |
| tags | `createTag` | POST /api/admin/tags | tag form |
| comments | `updateCommentBlocks` | PUT /api/comments/{id}/blocks | comment edit form |
| annotations | `updateAnnotation` | PUT /api/annotations/{id} | annotation edit form |
| documents | `createDocument` | POST /api/documents | document form |
| documents | `updateDocumentBlocks` | PUT /api/documents/{document_id}/blocks | document blocks form |
| forms | `createForm` | POST /api/forms | form builder |
| forms | `submitForm` | POST /api/forms/{id}/submissions | form-fill (HIGH value) |
| share-links | `createShareLink` | POST /api/share-links | share-link form |
| trails | `createTrail` | POST /api/trails | trail form |
| preferences | `sendPushBroadcast` | POST /api/admin/push/send | push form (HIGH value) |

> Each slice may have other create/update form actions whose endpoint does NOT appear in the audited 27 — only wire the actions whose endpoint is in the table. If an action's form uses a custom editor and lacks a `<Form>`/`useActionState` `state`, report it (DONE_WITH_CONCERNS) for manual handling.

### Group B — annotation create (direct fetch)
| Slice | Action | Endpoint | Note |
|---|---|---|---|
| annotations | `createAnnotation` | POST /api/entities/{type}/{id}/annotations | manual `fetch` → spread `headers: { ...existing, ...idempotencyHeaders(ctx.idempotencyKey) }` |

### Group C — imperative actions (createAction) + new foundation
**C0 (foundation):** extend `createAction` so the returned action accepts an optional 2nd argument `idempotencyKey?: string`, passed to the handler via a 2nd context arg `{ idempotencyKey }` (symmetric with `createFormAction.FormActionContext`). Non-breaking: existing 1-arg callers keep compiling. Add a client hook `src/hooks/use-idempotency-key.ts` (`useIdempotencyKey()` → `{ key, rotate }`, `key = crypto.randomUUID()`, `rotate()` mints a new one; caller rotates after success).

**C-wiring:** for each imperative action below, add the `idempotencyKey` handler param + `headers: idempotencyHeaders(idempotencyKey)`; update its calling client component (delete button / suggest button) to generate a key via `useIdempotencyKey()` and pass it, rotating on success.
| Slice | Action | Endpoint | Value |
|---|---|---|---|
| glossary (lectures slice) | `suggestGlossaryTerms` | POST /api/glossary/suggest | HIGH (dup expensive call) |
| comments | `deleteComment` | DELETE /api/comments/{id} | low (idempotent-by-effect) |
| annotations | `deleteAnnotation` | DELETE /api/annotations/{id} | low |
| banners | `deleteBanner` | DELETE /api/admin/banners/{id} | low |
| events | `deleteEvent` | DELETE /api/admin/events/{id} | low |
| glossary | `deleteTerm` | DELETE /api/admin/glossary/{id} | low |
| documents | `deleteDocument` | DELETE /api/documents/{document_id} + admin DELETE /api/admin/documents/{document_id} | low |

> DELETE-by-id is idempotent by effect; backend offers only 204-vs-404-on-replay. Wire for completeness per user's "all" decision, but this is the lowest-value tier.

---

## Phases (TodoWrite)
1. Group A — wire form actions+forms, one slice per task (sequential): banners, events, glossary, lectures, tags, comments(update), annotations(update), documents, forms, share-links, trails, preferences.
2. Group B — annotation create fetch spread.
3. Group C0 — createAction key support + useIdempotencyKey hook (foundation).
4. Group C-wiring — suggestGlossaryTerms + delete actions + their buttons.
5. Final holistic review + full gate.

## Self-Review
- Every audited endpoint (except already-wired `createComment`) has a task.
- Each slice preserves its `ERRORS` override.
- Group C foundation is non-breaking for existing `createAction` callers (verify via `pnpm typecheck`).
- No schema.ts edits (read-only dependency).
