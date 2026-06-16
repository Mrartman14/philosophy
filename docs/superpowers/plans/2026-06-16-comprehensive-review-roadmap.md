# Comprehensive Review Roadmap — Implementation Plan

> **For agentic workers:** This is a **master backlog**, not a single-feature plan. It indexes all 69 verified findings from the 2026-06-16 multi-agent review across 14 dimensions, grouped into 5 execution phases. Each task is a checkbox (`- [ ]`). When picking up a **foundation-zone** task (marked 🧊 — touches `src/components/ui/*`, `src/utils/*`, `src/app/layout.tsx`, etc.), spin out a focused sub-plan with `superpowers:writing-plans` first, because those touch frozen zones per CLAUDE.md and need a coordinated PR. Smaller in-feature tasks can be executed directly with `superpowers:subagent-driven-development`.

**Goal:** Track and gradually execute every improvement found in the comprehensive review — defects, consolidation, UX/DX, standards conformance — without losing anything.

**Architecture:** Phase 0 fixes verified live defects/secrets first (so later refactors land on a correct base). Phase 1 brings the app up to the Next App-Router streaming baseline. Phase 2 introduces foundation primitives that collapse ~1000+ lines of duplication. Phase 3 tests the security-critical surface and hardens offline. Phase 4 is a11y + onboarding polish.

**Tech Stack:** Next.js 16.1 (App Router, RSC, server actions), React 19.2 (+ React Compiler), TypeScript strict, Tailwind v4, Zod 4, Base UI Form, idb (IndexedDB), Vitest + jsdom, pnpm.

**Source of truth:** Workflow run `wf_911f84a6-b6e` — 78 raw findings → 69 confirmed, 9 rejected. Rejected items are listed in the Appendix so we don't re-litigate them.

**Conventions for every task (per CLAUDE.md):**
- Communicate in Russian. File/folder names in `src/` are kebab-case.
- NEVER `git stash`/`reset`/`checkout .`/`clean`; never `git add -A`/`-.` — stage only your own files by name.
- pnpm only (npm breaks the toolchain). Gate before any PR: `pnpm lint && pnpm test && pnpm build`.
- 🧊 = foundation/frozen zone → separate coordinated PR.
- Severity/effort tags: `[H/M]` = severity High, effort Medium. Effort S≈minutes–hours, M≈half-day–day, L≈multi-day.

---

## Validation pass (2026-06-16) — corrections applied

A second adversarial workflow (`wf_48742d3f-673`, 80 agents) re-checked every finding's legitimacy AND the correctness of each proposed fix; the 5 Phase-0 fixes were double-checked by 2 independent skeptics each. Verdict: **plan is trustworthy to execute — all errors are real** — but **9 GO, 57 REVISE, 3 DROP**: most fixes needed a correction (frozen-zone branch, completeness, or a wrong helper name). Phase 0 below is rewritten with the verified fixes. For Phase 1–4, **consult [Appendix C — per-task validation revisions](#appendix-c--per-task-validation-revisions) before executing each task.**

**Cross-cutting rules (apply throughout):**
1. **Every 🧊 task is a coordinated foundation PR**, never a feature branch — 12 of 15 Phase-2 tasks + 6 Phase-3/4 items touch frozen zones. Within each, pick the NON-frozen-edit alternative where one exists (e.g. P2.7/P2.8 reuse `rethrowApiError` instead of widening it).
2. **P0.1 precedes P2.2** and is independent of it (P0.1 defines the token *value*; P2.2 only hoists the class *string*). The plan's old "P2.2 de-risks P0.1" wording was backwards.
3. **New tokens (P2.2 danger/success, theme-color) must define REAL `:root` light+dark values**, never the `@theme`-only self-reference that caused the P0.1 bug. Land the P0.1 Step-4 CI guard first.
4. **P0.3 owns all `.env.production` mechanics**; P0.5 only deletes `deploy.yml`. Don't edit the env file in two tasks (parallel-agent clobber risk).
5. **P2.1 is NOT one primitive** — split into 3 client-safe exports: `toastActionError` (imperative ~34 sites), `<ActionFormError/>`/`<FormFeedback/>` (inline-JSX forms ~13–20 sites), `actionErrorMessage` in a CLIENT-SAFE `src/utils/action-message.ts` (NOT server-only `api-error.ts`). `forbiddenAction`/`forbiddenText` is a REQUIRED prop. Exclude toast/ERROR_TEXT/`<span>`-footer sites.
6. **Route-UX tasks (P1.1/P1.2/P1.3/P1.7 + findings 28/57) overlap** — treat as ONE work item so two agents don't add `loading.tsx` to the same segment. `/search` gets a Suspense-around-`SearchBody` (P1.7), NOT a route `loading.tsx`. Scoped `error.tsx` uses `min-h-[40vh]`.
7. **Offline cluster (P3.8–P3.13) is on the DORMANT write/SW path.** Do now: P3.9 (atomic update), P3.13 (hash-derived `sw.js` version). DEFER P3.8/P3.10/P3.11 to slice-A resumption (Web Locks etc. need design; idempotency already neutralizes the data-integrity harm).

**DROPPED (do not execute):**
- **P2.11** (`idSchema` for 37 `z.uuid`) — the 37 sites are 15 distinct localized messages, 3 don't fit the template; helper would live in frozen `src/utils` and hurt i18n grep-ability. Duplication is cheaper than the abstraction.
- **P2.14** (reuse `Button` for PWA buttons) — frozen zone + silent height regression (`<Button size=sm>` is h-8/32px vs inline ~28px). Cosmetic-only; not worth a foundation PR + geometry risk.
- **P4.7** (converge `useState(pending)` onto a primitive) — DEFER: blanket `useTransition` swap is not behavior-neutral (shared vs split pending flags); `ConfirmDialog` already covers delete buttons; `ActionButton` lands in frozen `ui/`. Revisit only as a deliberate foundation PR.

---

## Phase 0 — Stop the bleeding (verified defects & secrets)

> Each is a verified live bug or leaked secret with user-visible/security impact and small effort. Do these before any refactor. The CSS-token and media-cache fixes are silent (no error) and high blast-radius. **All 5 rewritten below per the validation pass.**

### Task P0.1 🧊 — Define `--color-foreground` and `--color-text` (broken core token) `[H/S]`

**Files:**
- Modify: `src/styles/themes/rebus.css` (`:root` light at lines 1–9, dark `@media` at 10–18)
- Inspect: `src/app/globals.css:13` (`@theme` self-reference), `:27` (forced-colors-only def)
- Inspect consumers: `src/components/ui/button.tsx:11,39`, `icon-button.tsx`, `checkbox.tsx`, canvas node text
- Fix orphan: `src/features/search/ui/search-results.tsx:79` (`text-(--color-text)`)

**Problem:** `--color-foreground` is the most load-bearing token (primary Button/IconButton bg, checkbox fill, PWA buttons, ALL six focus rings) but `rebus.css` never defines it in `:root` — its only real definition is inside `@media (forced-colors: active)`. `globals.css:13` `--color-foreground: var(--color-foreground)` is self-referential → resolves to nothing in normal light/dark. So primary buttons have no background and focus rings have no outline color. Separately `search-results.tsx:79` uses `text-(--color-text)`, an orphan token defined nowhere.

- [ ] **Step 1 (token — the real fix):** Add `--color-foreground` to BOTH the light `:root` AND the dark `@media` block in `rebus.css`. Omitting dark would bleed near-black onto the `#111a20` navy bg → invisible primary buttons/checkboxes/focus rings in dark mode (strictly worse than today). Light: near-black (`#1a1a1a` / `#1a1f24`); dark: near-white (`#e6ebf0`, or reuse the cream `#f6f2eb`). Keep `globals.css:13` untouched — it is the `@theme` registration, not the bug.
- [ ] **Step 2 (orphan `--color-text`):** DELETE the `text-(--color-text)` class at `search-results.tsx:79` entirely. It sits on the snippet `<li>` (result body text) which already inherits the readable UA default (`<body>` sets only bg). Do NOT swap to `--color-foreground` (full-strength, unintended) or `--color-description` (dims the snippet — that's a metadata-chip color). Zero visual change.
- [ ] **Step 3:** Verify visually (`pnpm dev`, port 3001): primary buttons have a filled bg and focus rings are visible on Tab in BOTH light and dark schemes.
- [ ] **Step 4 (follow-up, touches build config — separate small PR):** Add a CI guard asserting every `@theme` token in `globals.css` has a real `:root` value in `rebus.css`. This also protects the new tokens P2.2 will add — land it before P2.2.
- [ ] **Step 5:** `pnpm lint && pnpm build`; commit. **Ordering:** P0.1 DEFINES the token value; P2.2 later only hoists the class string into a const → P0.1 is independent of and precedes P2.2.

### Task P0.2 — Gate `updateLecture` & `setLectureVisibility` + forward idempotency `[M/S]`

**Files:** Modify `src/features/lectures/actions.ts:79-91` (`updateLecture`), `:93-104` (`setLectureVisibility`). Reference siblings: `createLecture:60-77`, `deleteLecture:106+`, `loadLectureForGate:54-58`.

**Problem:** These two mutations call neither `getMe()` nor `requireCapability` (every sibling does), relying solely on the backend owner-check — violating the CLAUDE.md defense-in-depth contract. They also omit `idempotencyHeaders(ctx.idempotencyKey)` even though the backend now enforces Idempotency-Key on all mutations.

- [ ] **Step 1 (gate — exact helpers):** Change each handler to `(formData, ctx)`. After `parseFormData`, load the resource via `loadLectureForGate(input.id)` and gate with the REAL owner-aware helpers: `requireCapability(me, (m) => canUpdateLecture(m, lecture))` for `updateLecture`, and `canSetLectureVisibility` for `setLectureVisibility` (`lectures/permissions.ts:10,18`). ⚠️ `canEditLecture` does NOT exist — do not use it; do NOT use the `requireActive` arm (it drops the owner check the helpers + the edit-page gate enforce). Add `canUpdateLecture, canSetLectureVisibility` to the import block at `actions.ts:21-27` or `tsc` fails (`getMe` is already imported).
- [ ] **Step 2:** Add `headers: idempotencyHeaders(ctx.idempotencyKey)` to both `api.PUT`/`api.PATCH` calls.
- [ ] **Step 3:** Verify the denied path returns `{success:false, code:"forbidden"}` without hitting the API (becomes a test in P3.1). Note: `loadLectureForGate` maps 404 → `ForbiddenError("owner")`, so a bad id now surfaces as `code:"forbidden"` instead of `NOT_FOUND` — a minor UX shift the edit form tolerates.
- [ ] **Step 4:** `pnpm lint && pnpm test && pnpm build`; commit.

### Task P0.3 — Remove + rotate the committed VAPID private key `[H/S]`

**Files:** `.env.development:4`, `.env.production:4` (both contain `VAPID_PRIVATE_KEY=…`, both git-tracked), `.gitignore:34` (`# .env*` commented out).

**Problem:** A real private signing key (`VAPID_PRIVATE_KEY`) is committed in plaintext in BOTH `.env.development:4` and `.env.production:4`, both git-tracked. The frontend never uses it — and the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` line is also dead (the public key is fetched from the backend `GET /api/push/vapid-key`, `preferences/api.ts:31-37`, "НЕ из env"). Pure secret leakage. **This task owns ALL `.env.production` mechanics** (P0.5 only deletes `deploy.yml`).

- [ ] **Step 1 (MANDATORY before untracking — else prod build breaks):** Add `NEXT_PUBLIC_BASE_URL` + `NEXT_PUBLIC_BASE_PATH` as a literal `env:` block on the `pnpm build` step of `.github/workflows/ci.yml` (~line 29) — neither workflow has an `env:` block today, and these non-secret public values are consumed at build time (`share-url.ts:30`, `use-register-sw.ts:17`). (If P0.5 hasn't deleted `deploy.yml` yet, add it there too.)
- [ ] **Step 2 (needs user go-ahead + backend):** Backend key ROTATION is the only real remediation — untracking leaves the key in history (entered at commit `23e584c7`). Coordinate as a cross-team backend rollout; flag that rotating the public half **invalidates every existing browser PushSubscription**.
- [ ] **Step 3:** `git rm --cached .env.development .env.production`; delete BOTH the `VAPID_PRIVATE_KEY` lines AND the dead `NEXT_PUBLIC_VAPID_PUBLIC_KEY` lines.
- [ ] **Step 4:** Scope `.gitignore` to `.env*.local` plus `!.env.example` — NOT a blanket `.env*` (that would also untrack the public base values still needed). Add `.env.example` (var names only, no values).
- [ ] **Step 5:** `pnpm lint && pnpm build`; commit.

### Task P0.4 — Fix `getMediaById` cross-user private-cache leak `[H/M]`

**Files:** Modify `src/features/media/api.ts:83-99`. Reference: `src/api/client.ts:8-17` (`createApiClient` attaches viewer JWT), `media/types.ts` (`private | public` visibility).

**Problem:** The no-token path wraps an authed (`createApiClient`) call in `unstable_cache` keyed only by `["media-by-id", id]`, tag `[MEDIA:id]`, no `revalidate`. `unstable_cache` is global/cross-request/cross-user — there is no actor/visibility dimension in the key. Owner A's private media (200 + signed URL) gets cached under the id and served to user B who should get 404. The token path already bypasses cache for this exact reason; the authed no-token path reintroduces the leak. No `revalidate` also means short-TTL signed URLs outlive their expiry.

- [ ] **Step 1 (option (b) ONLY):** Drop `unstable_cache` for `getMediaById`; keep the outer `React.cache()` at `api.ts:63` (per-request/per-actor safe), mirroring `getMyMedia` (`api.ts:30`) which documents exactly this. ⚠️ REJECT the "at minimum add `revalidate`" fallback — it only bounds staleness and leaves the privacy leak open within the TTL window (a non-fix for a credential leak).
- [ ] **Step 2 (MANDATORY or `pnpm lint` fails):** Remove the now-unused `unstable_cache` import (`api.ts:3`) and `Tags` import (`api.ts:7` — after deleting the cached fetcher it's only referenced in a doc comment); rewrite the stale doc comment (`api.ts:56-61`) that claims per-id cross-request caching. (`api.ts:97` is the SOLE media-tagged fetcher → the `revalidateEntity(Tags.MEDIA,…)` calls in actions become harmless no-ops; leave them.)
- [ ] **Step 3:** Add a fetcher test (folds into P3.5) asserting a private media response is not served cross-actor.
- [ ] **Step 4:** `pnpm lint && pnpm test && pnpm build`; commit.

### Task P0.5 — Delete dead GitHub-Pages deploy workflow + fix prod URL `[M/S]`

**Files:** Delete `.github/workflows/deploy.yml`. Do NOT mutate `.env.production` here (env mechanics live in P0.3). Reference: `next.config.ts` (no `output:"export"`), `Dockerfile` (real deploy = `pnpm start` Node SSR).

**Problem:** `deploy.yml` publishes `./out` to GitHub Pages, requiring static export — but there's no `output:"export"`, the app uses 25 server actions + `cookies()`, so `pnpm build` emits `.next/` never `./out`. The workflow can never produce a working build (`workflow_dispatch`-only, never auto-runs).

- [ ] **Step 1:** Delete `.github/workflows/deploy.yml` as-is (low risk — it can never build and never auto-runs).
- [ ] **Step 2:** Do NOT independently edit `.env.production` here — all env mechanics (untrack, CI `env:` block, VAPID scrub) are done ONCE in P0.3 to avoid two agents clobbering the file. If a real prod origin is wanted for `NEXT_PUBLIC_BASE_URL`, CONFIRM it with the deployer (the `github.io/philosophy` value is wrong for the SSR root-origin Docker deploy) — do not guess.
- [ ] **Step 3:** Document the real deploy path (Dockerfile → container host SSR) in README (folds into P4.8). Commit. (Runtime-correctness item, not pure DX.)

---

## Phase 1 — RSC streaming, waterfalls & critical-path perf

> Highest user-facing ROI, mostly mechanical. The `Skeleton` primitive and the lecture page's `Promise.all` already prove the patterns. Brings the app up to the Next App-Router baseline it currently sits below.

### Task P1.1 — Add `loading.tsx` to high-traffic public segments `[M/M]`

**Files:** Create `loading.tsx` in `src/app/lectures`, `src/app/documents`, `src/app/glossary`, `src/app/trails`, `src/app/search`, `src/app/notifications`, `src/app/me`. Model on `src/app/admin/loading.tsx`. Primitive: `Skeleton` from `src/components/ui`.

**Problem:** Across ~58 pages only `admin/loading.tsx` exists. `getMe()`/`cookies()` force dynamic per-request rendering, so every public route shows a frozen previous page until the full server fetch chain resolves.

- [ ] **Step 1:** (Optional but DRY) add a shared `<RouteSkeleton variant="list|detail">` to `src/components/shared` (not frozen `ui/`) for reuse.
- [ ] **Step 2:** Add `loading.tsx` per segment rendering the skeleton.
- [ ] **Step 3:** Verify each route shows an instant skeleton on navigation (`pnpm dev`). `pnpm lint && pnpm build`; commit per segment or as one PR.

### Task P1.2 — Wrap async server sections in `Suspense` for streaming `[M/M]`

**Files:** Modify `src/app/lectures/[id]/page.tsx:43-63` (wrap `LectureDocumentsSection`, `LectureMediaSection`, `CommentSection` individually). Same for `AnnotationsSection`/`DocumentContainers` on the document page. Sections: `lecture-documents-section.tsx:15`, `comment-section.tsx:75`.

**Problem:** Pages embed async sections that fetch their own data but none are `Suspense`-wrapped, so React awaits every section before flushing any HTML. `LectureDetail` (already resolved via `Promise.all`) can't paint until the comment-tree + documents + media fetches finish. Suspense appears in only 2 spots app-wide → streaming effectively unused.

- [ ] **Step 1:** Wrap each independent async section in `<Suspense fallback={<Skeleton/>}>` so `LectureDetail` streams immediately.
- [ ] **Step 2:** Verify with throttled network that the shell + detail paint before slow sections fill in. `pnpm lint && pnpm build`; commit.

### Task P1.3 — Add `global-error.tsx` + scoped `error.tsx` for public routes `[M/M]`

**Files:** Create `src/app/global-error.tsx`; create `error.tsx` for heavy public segments (lectures, search, glossary, documents). Reuse `src/app/error.tsx:1-23` markup as a shared `<RouteError>` in `src/components/shared`. Note: root `error.tsx` already renders inside the layout, so this is about localized recovery + fixing the cosmetic `min-h-screen` overshoot (use `min-h-[40vh]` like `admin/error.tsx:10`).

**Problem:** 0 `global-error.tsx`, only root + admin `error.tsx`. A fetch failure in a public section bubbles to the single root boundary; sections don't guard their awaits, so a transient API error blanks the whole page rather than one section. (Verifier note: root boundary is NOT wiped per Next nesting — so scope this to localized recovery + the min-height cleanup, not "nav gets wiped".)

- [ ] **Step 1:** Add `global-error.tsx` (catches errors thrown in the root layout itself).
- [ ] **Step 2:** Extract shared `<RouteError>` and add scoped `error.tsx` for the heavy segments.
- [ ] **Step 3:** Fix `min-h-screen` → `min-h-[40vh]` in root `error.tsx:10` and `not-found.tsx:7`.
- [ ] **Step 4:** Tests fold into P3.7. `pnpm lint && pnpm build`; commit.

### Task P1.4 — `Promise.all` the 7 sequential `getMe()→getXById()` detail pages `[M/S]`

**Files:** `src/app/documents/[id]/page.tsx:39-40`, `trails/[id]/page.tsx:31-32`, `forms/[id]/page.tsx:32-33`, `canvases/[id]/page.tsx:28-29`, `forms/[id]/submissions/page.tsx:20-21`, `admin/lectures/[id]/edit/page.tsx:29-30`, `admin/lectures/[id]/attachments/page.tsx`.

**Problem:** Two sequential awaits where the entity id comes from `params`, not `me` — they're independent. Serializes two backend RTTs per render. `lectures/[id]/page.tsx:29` already does `Promise.all` correctly.

- [ ] **Step 1:** Replace with `const [me, x] = await Promise.all([getMe(), getXById(id, token)]);` on each page. `getMe` is `React.cache`'d so parallel calls dedupe.
- [ ] **Step 2:** `pnpm lint && pnpm test && pnpm build`; commit.

### Task P1.5 — Use `parseNonNegativeInt` for offset everywhere `[L/S]`

**Files:** `src/app/media/my/page.tsx:24`, `src/app/admin/tags/page.tsx:29`, `src/app/notifications/page.tsx:24`. Util: `src/utils/paging.ts:11-31`.

**Problem:** These 3 reimplement offset parsing inline (`parseInt || 0`), accepting fractional/negative offsets the hardened `parseNonNegativeInt` rejects — leaking bad offsets to the API.

- [ ] **Step 1:** Replace each inline parser with `parseNonNegativeInt(rawOffset, 0)` (or `parsePaging`).
- [ ] **Step 2:** `pnpm lint && pnpm test && pnpm build`; commit.

### Task P1.6 — Code-split the Tiptap editor off the lecture-page critical path `[M/M]`

**Files:** `src/components/ast-editor/ast-editor.tsx`, consumed by `comments/ui/comment-create-form.tsx:5`, rendered by `comment-section.tsx:110-118`. Lecture detail always renders `CommentSection`.

**Problem:** `AstEditor` statically imports the full Tiptap/ProseMirror stack (~7.5M + 4M node_modules). Every authenticated lecture view downloads/parses the entire editor JS even if the user never comments. No `next/dynamic` anywhere in the repo.

- [ ] **Step 1:** Wrap the editor at its consumption boundary in `next/dynamic` (`ssr:false`) with a lightweight textarea/skeleton fallback, **or** gate it behind a "write a comment" toggle so the chunk loads on intent. (Note: cannot apply `ssr:false` dynamic directly inside an async Server Component — introduce a thin client wrapper.)
- [ ] **Step 2:** Verify the editor chunk is no longer in the lecture-page initial bundle (`pnpm build` + inspect chunk output). Commit.

### Task P1.7 — Stream the search page body `[L/S]`

**Files:** `src/app/search/page.tsx:40-52` (renders `SearchBody`), `:55-78` (`SearchBody` async).

**Problem:** The page already factors the slow part into async `SearchBody` (textbook streaming setup) but renders it inline without `Suspense`, so the static input/header can't paint until `getSearchResults` resolves.

- [ ] **Step 1:** Wrap `<SearchBody/>` in `<Suspense>` keyed on the query (`q/type/offset`) with a results-skeleton fallback. Commit.

### Task P1.8 — Fix N+1 per-lecture tag fetch on the lectures list `[L/M]`

**Files:** `src/app/lectures/page.tsx:39-45`. Fetcher: `lectures/api.ts:27-50` (list doesn't embed tags).

**Problem:** The list fans out one `getLectureTags()` per lecture (≤20) inside `Promise.all` — 20+ RTTs to render tag chips on the most-trafficked page, blocking the whole render.

- [ ] **Step 1 (short term):** Move tag enrichment into a `Suspense`-wrapped async sub-component so cards stream without waiting on the tag fan-out.
- [ ] **Step 2 (long term, backend ask):** File a batch-endpoint request with philosophy-api (tags for a set of lecture ids → 1 request). Isolate in one place so the swap is cheap. Commit.

### Task P1.9 — Reduce `getDocumentSubscription` over-fetch (backend ask) `[L/M]`

**Files:** `src/features/notifications/api.ts:104-121`, `src/app/documents/[id]/page.tsx:49-54`.

**Problem:** To render the Subscribe button's initial state, every logged-in viewer GETs `/api/me/subscriptions?limit=100` and scans for a match — pulls up to 100 rows per document SSR to compute one boolean, and silently returns wrong state for users with >100 subscriptions.

- [ ] **Step 1 (backend ask):** Request a `subscribed` flag in the document detail DTO (or HEAD `/api/documents/{id}/subscribe`), then read from the already-fetched `document`.
- [ ] **Step 2 (interim):** Document the >100 cap as a known correctness gap; consider raising the limit. Commit.

---

## Phase 2 — Foundation primitives that kill the duplication 🧊

> Each is one foundation-layer change removing hundreds of lines AND the drift the duplication causes. They touch frozen zones (`ui/`, `utils/`, `layout.tsx`) → **coordinated PRs per CLAUDE.md**, sequenced after Phase 0/1. Spin a focused sub-plan per task before implementing.

### Task P2.1 🧊 — FormStatus + action-toast + actionErrorMessage primitives `[M/M]`
*(Merges 5 findings: shared action-result toast handler, forbidden/action-error message helper, form-error footer + state-bootstrap, FormFeedback/StatusText, and the ux forbidden-message helper.)*

**Files:** Create `src/utils/action-toast.ts` (client-safe `toastActionError(toast, result, {action})`), `src/utils/action-message.ts` (`actionErrorMessage(result, action)` handling forbidden **and** suspended status), `src/utils/action-result.ts` (`fieldErrorsOf(state)`, `initialResult<T>()`); add `<FormStatus state forbiddenText/>` to `src/components/ui`. Touch points: ~68 files with the `code === "forbidden"` branch, ~37 forms with the footer triad, ~35 `initial: ActionResult` bootstraps, 12 delete buttons.

**Problem:** The branded forbidden-vs-error branch is hand-written in 68 files; the field-error ternary in ~29; the success/`_form` footer in ~29; the initial-result factory in ~35. No shared helper exists. Inconsistent titles already exist ("Нет прав" vs "Не удалось удалить"), and the CLAUDE.md branded-forbidden rule is enforced by copy-paste, not a primitive. The `_form` key is also never rendered by any form (latent: a root-level cross-field refinement would be invisible).

- [ ] **Step 1:** Design the API (sub-plan). Decide `FormStatus` renders forbidden/generic/`_form`/success with `role="alert"/"status"` and canonical danger/success classes (coordinate with P2.2 tokens).
- [ ] **Step 2:** TDD the helpers (`toastActionError`, `actionErrorMessage`, `fieldErrorsOf`, `initialResult`) + `FormStatus` component with tests.
- [ ] **Step 3:** Migrate forms/delete buttons incrementally to the primitives; each form shrinks to `<FormStatus state={state} forbiddenText="создание термина"/>`. Make `_form` banner default behavior.
- [ ] **Step 4:** Optionally add a shared `<DeleteButton>` wrapping `ConfirmDialog` (12 buttons differ only in title/description/action/redirect-vs-refresh).
- [ ] **Step 5:** `pnpm lint && pnpm test && pnpm build` per migration batch; commit.

### Task P2.2 🧊 — Tokenize danger/success colors + hoist input-shell/focus-ring + theme-color meta `[M/M]`
*(Merges 3 findings: danger/success tokens (red-600 ×77), input-shell/focus-ring base classes, theme-color meta from tokens.)*

**Files:** `src/styles/themes/rebus.css` (add `--color-danger`, `--color-danger-bg`, `--color-success` light+dark), `src/app/globals.css` (`@theme`), `src/components/ui/{button,icon-button,text-input,textarea,select,checkbox,form-field}.tsx`, `src/components/ui/cn.ts` (or a variants module: `INPUT_SHELL`, `FOCUS_RING` constants), `src/app/layout.tsx:58-64` (theme-color meta), `src/features/canvas/ui/editor-node-layer.tsx:51` (magic `#dc2626`).

**Problem:** Semantic feedback colors bypass tokens: `red-600` ×77 with inconsistent red-500/700/50 and a raw `#dc2626`; `green-600` ×5. The input-shell class and the focus-ring triplet are copy-pasted across 6 components (offset already diverges: inputs `offset-0`, buttons `offset-2`). Theme-color meta hardcodes hex that's desynced from `--color-background` in light mode (`#f8f8f8` vs `#f6f2eb`).

- [ ] **Step 1:** Add `--color-danger`/`--color-danger-bg`/`--color-success` tokens; expose via `@theme`.
- [ ] **Step 2:** Replace `red-600/500/700`, `green-600`, `#dc2626` with `text-(--color-danger)` etc.; standardize one danger shade.
- [ ] **Step 3:** Define `INPUT_SHELL` + `FOCUS_RING` constants; compose via `cn()` in the 6 components; pick one canonical focus-offset. (De-risks P0.1.)
- [ ] **Step 4:** Source theme-color meta from tokens (or fix light to `#f6f2eb`).
- [ ] **Step 5:** `pnpm lint && pnpm build`; visual check; commit.

### Task P2.3 🧊 — Query-preserving Pagination → delete 5 byte-identical clones `[M/M]`
*(Merges 2 findings: consolidation + styling views of the same duplication.)*

**Files:** `src/components/ui/pagination.tsx:24-72`; delete `src/features/{media,annotations,search,audit,canvas}/ui/*-pagination.tsx`; re-export from each slice `index.ts`.

**Problem:** 5 slices ship byte-identical pagination clones because the kit `Pagination` builds href from `basePath` only and drops other searchParams (its own docstring admits this). Any a11y/styling/math fix must be applied 5×.

- [ ] **Step 1:** Add a `preserveQuery` prop (or a client `QueryPagination` reading `usePathname()`/`useSearchParams()` and merging `offset` into the live query).
- [ ] **Step 2:** Delete the 5 clones; re-export the kit component from each slice index.
- [ ] **Step 3:** `pnpm lint && pnpm test && pnpm build`; commit. (~250 lines → ~40.)

### Task P2.4 — `useQueryFormSubmit` hook → 5 search/filter forms `[M/M]`

**Files:** Create `src/hooks/use-query-form-submit.ts`; migrate `glossary/ui/glossary-search-form.tsx:12-44`, `comments/ui/comment-search.tsx:18-50`, `canvas/ui/canvas-search.tsx:8-34`, `lectures/ui/lecture-search-form.tsx:14-67`, `audit/ui/audit-filter-form.tsx:42-55`, `search/ui/search-input.tsx:51-71`.

**Problem:** 5+ forms hand-roll the same controller: read `useSearchParams()`, build `new URLSearchParams(...)`, set-or-delete fields, `delete("offset")`, `startTransition(() => router.replace(...))`. Same logic the pagination clones duplicate.

- [ ] **Step 1:** TDD `useQueryFormSubmit({resetParams:["offset"]})` returning an `onSubmit` that merges named FormData fields into the current query and `router.replace`s in a transition.
- [ ] **Step 2:** Migrate the 5 forms (markup stays). Canvas-search also gains the missing pending state + shared `Button`.
- [ ] **Step 3:** `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.5 🧊 — `unwrapList`/`unwrap` helpers → drop ~24 extractions + ~100 casts `[M/M]`
*(Merges 2 findings: ~100 `data.data as T` casts + the 24-fetcher envelope/pagination boilerplate.)*

**Files:** Create `src/utils/api-unwrap.ts` (`unwrapList(resp, {offset,limit})` → `{items,total,offset,limit}`, `unwrap(resp)` → `data.data ?? null`, generic over the openapi-fetch success type). Migrate ~17 `api.ts` files. Counterexamples proving safety: `users/api.ts:38` (uncast, compiles), `comments` `getBlock`.

**Problem:** Every list fetcher repeats `total: data.pagination?.total ?? 0, ...` (24×) plus a local `XListResult` interface; nearly every fetcher casts `(data.data ?? []) as T` (~100×). The casts are no-ops (schema already narrows `data` per-endpoint) that **defeat drift detection** — a backend regen silently forces through instead of failing the build.

- [ ] **Step 1:** TDD the generic helpers so types flow through without casts.
- [ ] **Step 2:** Migrate per slice: `return unwrapList(res, {offset,limit})` / `return unwrap(res)`; drop the casts. Verify each with `pnpm build` (restores compile-time drift detection).
- [ ] **Step 3:** `pnpm lint && pnpm test && pnpm build`; commit per slice batch.

### Task P2.6 🧊 — Shared `blocksJson` Zod field → dedup 10 copies + remove `as never` holes `[M/M]`
*(Merges 2 findings: forms-validation decoder dedup + typescript `BlocksJsonSchema`/`as never`.)*

**Files:** Create `src/utils/blocks-json.ts` (`blocksJson({allowEmpty})` factory). Migrate `documents/schemas.ts:7-28`, `glossary/schemas.ts:11-32`, `events/schemas.ts:106-126`, `banners/schemas.ts:118-128`, `comments/schemas.ts:12`, `annotations`, `canvas`, `forms`, `trails`, `tags`. Call sites with `blocks as never`: `comments/actions.ts:70,98`, `banners:90`, `annotations:115`, `documents:67,159`, `events:74`, `glossary:75`.

**Problem:** 10 slices hand-roll "parse JSON → assert Array → return `unknown[]`" with drifted rules (documents rejects empty; glossary/events accept it; messages differ per slice). Because output is `unknown[]`, every call site casts `blocks: input.blocks as never` — the strongest escape hatch, disabling ALL type-checking on the AST request body.

- [ ] **Step 1:** TDD `blocksJson({allowEmpty})` with one canonical message set and explicit `path:['blocks']`. Type output as `components["schemas"]["ast.Block"][]` (or a real AST Zod schema).
- [ ] **Step 2:** Migrate the 10 slices; remove `as never` at all 9 call sites (now type-checked end-to-end).
- [ ] **Step 3:** `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.7 — `assertOk` helper for the never-error openapi-fetch workaround `[L/S]`

**Files:** Add `assertOk(error, fallbackMessage)` to `src/utils/api-error.ts`. Sites: `comments/api.ts:39-40`, `banners/api.ts:97-100`, `tags/api.ts:34-39`.

**Problem:** Routes whose OpenAPI error is typed `never` (e.g. `/api/comments/schema`) carry an identical `eslint-disable` + comment + `throw new Error('...')` (no `error.error`), copy-pasted across 3 sites.

- [ ] **Step 1:** TDD `assertOk` encapsulating the `never`-error narrowing + throw (eslint-disable lives in one place).
- [ ] **Step 2:** Replace the 3 sites with one call each. `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.8 — Broaden `rethrowApiError` param → drop `error as ApiError` casts `[L/S]`

**Files:** `src/utils/api-error.ts:22` (widen param); remove casts at `media/actions.ts:56,77`, `statistics/actions.ts:27`, `preferences/actions.ts:54,69,81,98`, `share-links/actions.ts:57,77,98`, `annotations/actions.ts:120,139,161`, `lectures/actions.ts:138,155,185,218,238,324`, `notifications/actions.ts:27,43,53,64,75`. Canonical uncast form: `_template/actions.ts:33`.

**Problem:** 8 slices cast `rethrowApiError(error as ApiError, …)`, 8 (+ template) don't. The cast is a redundant no-op where the only error body is `httputil.ErrorResponse`, and cargo-culting it hides which endpoints actually need narrowing + swallows future drift.

- [ ] **Step 1:** Make the param accept `{ code?: ApiErrorCode; error?: string } | undefined`-compatible input so uncast `error` type-checks.
- [ ] **Step 2:** Remove all `error as ApiError` casts to match the template; where a union truly needs narrowing, use an explicit type guard. `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.9 — `requireActiveUserOrRedirect` helper for the 10-page auth gate `[L/S]`

**Files:** Add `requireActiveUserOrRedirect(nextPath)` to a server-only auth util (near `src/utils/me.ts`). Migrate `documents/my:24`, `media/my:21`, `trails/my:22`, `me/forms:11`, `me/submissions:11`, `canvases/page:24`, `canvases/new:11`, `share-links:18`, + 2 more (canvases/[id]/edit templates the id).

**Problem:** 10 pages copy `const me = await getMe(); if (me?.status !== "active") redirect("/login?next=<thisPath>");` — easy-to-mistype `?next=`. The server-action `requireActive` throws `ForbiddenError` (wrong semantics for a page).

- [ ] **Step 1:** TDD the helper: calls `getMe()`, redirects to `/login?next=<encoded>` when not active, returns narrowed active `me`.
- [ ] **Step 2:** Migrate each page to `const me = await requireActiveUserOrRedirect("/documents/my");`. `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.10 — Move `toRfc3339` + `DATE_ONLY` regex into shared util `[L/S]`

**Files:** Add to `src/utils/format-time.ts`; import from `events/schemas.ts:14-20` and `banners/schemas.ts:18-22`; also dedup the `ISO_DATE` regex in `lectures/schemas.ts:9`.

**Problem:** `toRfc3339` is byte-for-byte identical in events + banners (banners even comments "как в слайсе events"); `DATE_ONLY` regex re-declared in 3 places.

- [ ] **Step 1:** TDD `toRfc3339` + `DATE_ONLY` in the shared util.
- [ ] **Step 2:** Import from both slices; remove local copies. `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.11 — `idSchema(label)` helper for the ~37 `z.uuid` copies `[L/S]`

> ⛔ **DROPPED by validation pass.** The 37 sites are 15 distinct localized messages (3 don't fit the `id <entity>` template at all); the helper would live in frozen `src/utils` and hurt i18n grep-ability. Duplication is cheaper than the abstraction. Do not execute.


**Files:** Add `idSchema(entityLabel)` / `entityIdObject(label)` to shared schema infra. Sites: `z.uuid("Некорректный id …")` ×37 across `src/features/*/schemas.ts`; 12 standalone `XIdSchema` objects.

**Problem:** `z.uuid("Некорректный id <entity>")` repeated 37×; centralizing keeps the localized message consistent.

- [ ] **Step 1:** TDD `idSchema(label)` returning `z.uuid(\`Некорректный id ${label}\`)`.
- [ ] **Step 2:** Migrate call sites. `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.12 🧊 — Shared `ExportLinks` component + fix 2 hardcoded `API_URL` `[L/S]`

**Files:** Add `<ExportLinks urls={{md,txt}} label? className?/>` to `src/components/ui` (or `shared`). Migrate 8 slices: `lecture/document/glossary/comment/event/annotation/banner/search-export-links.tsx`. Fix hardcoded `process.env.API_URL ?? "http://localhost:8080"` → import `API_URL` from `@/api/client` in `comment-export-links.tsx:8`, `search-export-links.tsx:7`.

**Problem:** URL building is correctly shared (`@/utils/export-urls`), but the anchor markup (`<a … target="_blank" rel="noopener noreferrer">.md/.txt</a>`) is copied across 8 components, and 2 hardcode `API_URL` instead of the single source.

- [ ] **Step 1:** Build `ExportLinks` with canonical rel/target. Keep per-slice URL builders.
- [ ] **Step 2:** Migrate 8 slices; fix the 2 `API_URL` fallbacks. `pnpm lint && pnpm test && pnpm build`; commit.

### Task P2.13 🧊 — `Chip`/`Badge` primitive for the recurring pill `[L/S]`

**Files:** Add `<Chip variant interactive>` to `src/components/ui`. Sites: `lecture-card.tsx:40`, `lecture-detail.tsx:36`, `comment-type-badge.tsx:21`, `saved-lecture-view.tsx:215` (+ `search-results.tsx:64` rounded variant).

**Problem:** `rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-description)` copy-pasted in 4 places (lecture-card adds hover, comment-type-badge doesn't → drift).

- [ ] **Step 1:** Build `Chip` encapsulating the recipe (props for hover/interactive).
- [ ] **Step 2:** Replace inline pills. `pnpm lint && pnpm build`; commit.

### Task P2.14 🧊 — Reuse `Button` for PWA update/install actions `[L/S]`

> ⛔ **DROPPED by validation pass.** All 3 files are frozen, and `<Button size=sm>` (h-8/32px) silently changes the height of both compact banners (inline is ~28px, no fixed height; install-banner also drops `shrink-0`). Cosmetic-only — not worth a foundation PR + geometry regression. If ever pursued, scope to aligning only `hover:opacity-80→90` and EXCLUDE `admin-sidebar` (a nav-link active state, not a button).


**Files:** `src/components/app/update-prompt.tsx:15`, `install-banner.tsx:17` (also `admin-sidebar.tsx:26` inline primary).

**Problem:** The primary-button color pair is re-typed inline in 3 places and diverges (`hover:opacity-80` vs kit `90`; `rounded-lg` vs kit `rounded`).

- [ ] **Step 1:** Replace inline buttons with `<Button size="sm">`; align panel radius with kit default. `pnpm lint && pnpm build`; commit.

### Task P2.15 — Isomorphic `LectureDetailView` via `lectures/client.ts` `[L/M]`

**Files:** Create `src/features/lectures/client.ts` (mirror `comments/client.ts`); extract presentational header into a client-safe `LectureDetailView` (plain props). Consumers: server `lecture-detail.tsx:16-48` wraps it; `app/saved/saved-lecture-view.tsx:199-225` imports it.

**Problem:** `SavedLectureView` re-implements cover/title/date/tags/description markup that `LectureDetail` already owns (byte-identical), because lectures has no `client.ts`. Comments solved exactly this with an isomorphic `client.ts`.

- [ ] **Step 1:** Factor the pure header into `LectureDetailView`; export from `lectures/client.ts` (client-safe — no api/actions/permissions).
- [ ] **Step 2:** Wire both consumers; delete the duplicated markup. `pnpm lint && pnpm test && pnpm build`; commit.

---

## Phase 3 — Test the security-critical surface & harden offline

> After Phase 2 because the new primitives make per-slice tests cheaper and uniform. Closes the largest latent risk: a privilege-escalation, dropped-idempotency-key, or wrong-revalidate-tag refactor currently leaves the suite green.

### Task P3.1 — Per-slice `actions.test.ts`: RBAC-denied path via a shared driver `[M/M]`

**Files:** Create a shared test helper (e.g. `src/test/action-rbac-driver.ts`); add `actions.test.ts` per slice. Current gap: optlock tests blanket-stub `can* → true` (`comments/update-comment-blocks-optlock.test.ts:16-19`).

**Problem:** RBAC is the central contract but no per-action test exercises the **denied** branch, nor that each action calls `requireCapability` with the **correct owner-aware** helper. A deleted gate or wrong helper leaves the suite green.

- [ ] **Step 1:** Build a driver: stub `getMe` to a user lacking the capability; assert the action returns `{success:false, code:"forbidden"}` (or throws `ForbiddenError`) **without** calling `api.PUT/POST/DELETE`; on the allowed path assert the correct `can*` helper was consulted.
- [ ] **Step 2:** Fan out across slices, prioritizing lectures/documents/notifications/users. Includes a regression test for P0.2. `pnpm test`; commit.

### Task P3.2 — `actions.test.ts` for highest-blast-radius slices (verb/path, revalidate tag) `[M/L]`

**Files:** `lectures/actions.ts` (12 actions), `documents/actions.ts` (7), `notifications/actions.ts` (7), `users/actions.ts`. Only `auth/actions.test.ts` exists today.

**Problem:** ~96 mutating actions across 18 slices; only auth is tested. Untested: idempotency key passthrough, **correct revalidate tag** (a copy-paste wrong-entity tag is invisible), error-envelope mapping, ActionResult shape.

- [ ] **Step 1:** Per action assert: correct API verb+path, idempotency header forwarded from `ctx`, `revalidateEntity` called with expected tag+id, backend-error → branded result.
- [ ] **Step 2:** `pnpm test`; commit per slice.

### Task P3.3 — Generalize idempotency-key forwarding check `[L/S]`

**Files:** Promote the `comments/create-comment-idempotency.test.ts:42-55` assertion into a shared check; apply per mutating action.

**Problem:** Backend enforces Idempotency-Key on all mutations, but only ~7 actions verify the outgoing header end-to-end. A dropped key → duplicate mutations on retry.

- [ ] **Step 1:** Shared check: stub the API client, invoke with `ctx.idempotencyKey` set, assert `headers['Idempotency-Key']` equals it. Fan out across slices. `pnpm test`; commit.

### Task P3.4 — Form→action→render integration tests `[M/M]`

**Files:** Add `@testing-library/react` integration tests for representative patterns: `auth/ui/login-form.tsx` (create), `comments/ui/comment-edit-form.tsx` (optlock), a delete-button. Also test `components/ui/form-field.tsx:24-47`.

**Problem:** Zero tests mount a `<Form>`/`useActionState` and submit. The branded-forbidden text rule, field-error rendering under the right Base UI Field, optlock message, and idempotency hidden field are all unverified at the UI layer.

- [ ] **Step 1:** One test per pattern: (1) validation result renders the field error; (2) `{code:"forbidden"}` renders branded permission text (not raw `error`); (3) optlock conflict renders the refresh message. `pnpm test`; commit.

### Task P3.5 — `api.ts` fetcher tests (cache-tag wiring, soft-degrade) `[L/M]`

**Files:** Add focused tests beyond `canvas/api.test.ts`. Priority: fetchers that (a) carry tags consumed by `revalidateEntity`, (b) implement soft-degrade/not-found fallbacks (e.g. notifications' "soft-degrade subscription reads on network failure"). Includes the P0.4 media private-cache test.

**Problem:** Only 1 of 20 `api.ts` files is tested. A miswired cache tag produces wrong data with no error.

- [ ] **Step 1:** Mock `createApiClient`; assert the tag passed to `unstable_cache` matches the tag a mutation revalidates; assert network-failure returns the degraded shape. `pnpm test`; commit.

### Task P3.6 — Coverage thresholds + wire `test:coverage` into CI `[L/S]`

**Files:** `vitest.config.ts:5-19` (add `coverage` block), `.github/workflows/ci.yml:28` (run with coverage).

**Problem:** No coverage config/thresholds despite `@vitest/coverage-v8` + a `test:coverage` script; CI runs `pnpm test` (no coverage). 18/19 actions + 19/20 api untested can silently worsen.

- [ ] **Step 1:** Add a modest global floor + stricter per-dir thresholds for `src/features/*/actions.ts`, `src/utils/`, `src/services/offline/`.
- [ ] **Step 2:** Wire `test:coverage` into the CI gate. `pnpm test:coverage`; commit.

### Task P3.7 — Error/loading boundary tests `[L/S]`

**Files:** Render tests for `src/app/error.tsx`, `admin/error.tsx` (fallback + reset button); cover the new boundaries from P1.1/P1.3.

**Problem:** No boundary has a test; SSR fetch-failure UX is unverified.

- [ ] **Step 1:** Assert fallback renders + reset works; route forbidden()/notFound() to the right shell. `pnpm test`; commit.

### Task P3.8 — Cap outbox retry attempts `[M/S]` (offline)

**Files:** `src/services/offline/sync/drain.ts:90-101`; `store/outbox.ts` (`deleteOutboxCommand:92`, dead-letter).

**Problem:** `attempts` is incremented but **never read** — one permanently-failing command blocks the entire queue forever. No attempt cap, no dead-letter transition. (Note: write path is currently dormant — fold into offline-WRITE slice A when it resumes, but the fix is small and correct now.)

- [ ] **Step 1:** TDD: after N attempts mark `failed` (dead-letter) instead of returning to `pending`. Add GC for terminal `done` rows (delete-on-success). `pnpm test`; commit.

### Task P3.9 — Make `updateOutboxCommand` atomic `[L/S]` (offline)

**Files:** `src/services/offline/store/outbox.ts:77-90`.

**Problem:** `get` then `put` in two separate transactions (non-atomic), unlike `claimPending` which does both in one `readwrite` tx. Concurrent mutation clobbers.

- [ ] **Step 1:** TDD: do `get` + `put` in a single `readwrite` transaction. `pnpm test`; commit.

### Task P3.10 — Cross-tab lease to prevent double-send `[L/M]` (offline)

**Files:** `src/services/offline/sync/drain.ts:12` (module-scoped `draining` guard), `:49-55` (orphan-recovery loop).

**Problem:** The `draining` guard is per-tab/per-realm (no cross-tab mutual exclusion). The orphan loop unconditionally resets every `syncing` command to `pending` with no lease/age/owner check → a second tab can re-send an in-flight command.

- [ ] **Step 1:** Gate orphan recovery on `claimedAt` age or use the Web Locks API for cross-tab exclusion. TDD with `fake-indexeddb`. `pnpm test`; commit.

### Task P3.11 — IDB migration ladder + `blocked` handler `[L/M]` (offline)

**Files:** `src/services/offline/store/db.ts:28-45`.

**Problem:** `upgrade` only creates stores if absent (no versioned ladder); the `outbox` store is unversioned; `open` has no `blocked`/`blocking`/`terminated` callbacks, so a future version bump can hang.

- [ ] **Step 1:** Add a versioned `upgrade(db, oldV, newV)` ladder; add `blocked`/`terminated` handlers. TDD. `pnpm test`; commit.

### Task P3.12 — Periodic SW update check `[L/S]` (offline)

**Files:** `src/hooks/use-register-sw.ts:19-46`.

**Problem:** SW registered once on mount; no `registration.update()` on interval/visibility, so long-lived tabs miss the update prompt.

- [ ] **Step 1:** Call `registration.update()` on an interval and on `visibilitychange`. TDD (`use-register-sw.test.ts` exists). `pnpm test`; commit.

### Task P3.13 — Stop committing/re-stamping `sw.js` `[L/M]` (offline)

**Files:** `scripts/generate-sw-assets.mjs:9` (`Date.now()` version), `public/sw.js:3` (git-tracked, re-stamped each build).

**Problem:** Build timestamp churns the git diff every build (the current working-tree diff is exactly this); dev skips the generator so the file can go stale.

- [ ] **Step 1:** `.gitignore` `public/sw.js` and generate it in a `prebuild` step, **or** derive the version from a content hash (deterministic) instead of `Date.now()`. Commit.

---

## Phase 4 — A11y, onboarding hygiene & polish

> Lower blast-radius, partially deferred-scope (canvas). Mirror the project's own correct `AsyncCombobox` a11y pattern; clean up contributor-facing docs/tooling so the repo's mental model matches reality.

### Task P4.1 — Slash-menu: `aria-activedescendant` bridge + open/empty live region `[M/M]` (a11y)
*(Merges 2 a11y findings: activedescendant bridge + voice the open/empty transition.)*

**Files:** `src/components/ast-editor/toolbar/slash-menu.tsx:148-205,174-184`. Correct pattern to mirror: `pickers/async-combobox.tsx:91-105`.

**Problem:** The menu renders `role="listbox"`/`role="option"` + active index, but DOM focus stays in the contenteditable and nothing links them (no `aria-controls`, no `aria-activedescendant`, options have no ids). A SR user typing "/" hears nothing; arrowing announces nothing. The populated listbox has no live-region semantics (only the empty state is announced).

- [ ] **Step 1:** Give each option a deterministic id (`slash-opt-${i}`); set `aria-controls` + `aria-activedescendant` on the editing host. Announce open ("N команд, стрелки для навигации") via a polite status node. Mirror `AsyncCombobox`. Commit.

### Task P4.2 — Label `NetworkIndicator` + live region `[M/S]` (a11y)

**Files:** `src/components/app/network-indicator.tsx:33-36`, `assets/icons/offline-icon.tsx`, `app-header/app-header.tsx:44`.

**Problem:** Going offline swaps in a bare `<OfflineIcon>` SVG with no accessible name and no live region; the transition is silent and color/shape-only.

- [ ] **Step 1:** Wrap in an always-mounted `<span role="status" aria-live="polite">` rendering visually-hidden "Нет сети" when offline; give the icon an accessible name (`aria-label` or SVG `<title>`), mark decorative copy `aria-hidden`. Commit.

### Task P4.3 — Accessible names for comment-reaction toggles `[M/S]` (a11y)

**Files:** `src/features/comments/ui/comment-reactions.tsx:93-114`.

**Problem:** Each toggle's only accessible name is its glyph (★/+/−); the axis label (Согласие/Качество/Инсайт) is in a detached sibling. `aria-pressed` is correct but the label is missing.

- [ ] **Step 1:** Add `aria-label` per button combining axis + direction, e.g. `${axisLabel(axis)}: ${v===1 ? 'согласен' : 'не согласен'}` ("отметить как инсайт" for the star). Keep glyph visual-only. Commit.

### Task P4.4 — RefMenu: focus management + ESC at the category stage `[M/M]` (a11y)

**Files:** `src/components/ast-editor/pickers/at-menu.tsx:42-54`, `ref-menu.tsx:73-86`, `at-suggestion-plugin.ts:73-82`.

**Problem:** Typing "@" renders RefMenu as `role="dialog"` but nothing moves focus into it; at the category stage there's no ESC-to-close from within. `role="dialog"` without focus management is worse than a labelled non-modal menu.

- [ ] **Step 1:** Either drop `role="dialog"` (treat as non-modal labelled menu) or honor the contract: autofocus the first category button, trap/cycle Tab, handle Escape at every stage (close + restore caret). Commit.

### Task P4.5 — Canvas keyboard model (deferred) `[L/L]` (a11y)

**Files:** `src/features/canvas/ui/canvas-editor.tsx:121-234,333-374`.

**Problem:** `role="application"` + tabIndex=0 but selection/move/resize/edge/marquee are pointer-only — a keyboard user can delete/undo but cannot author a graph.

- [ ] **Step 1 (only if canvas un-defers):** Add roving focus across nodes, Enter/Space to select, arrows to nudge, a keyboard affordance to start/complete an edge, accessible name per node.
- [ ] **Step 2 (if staying deferred):** Document the limitation. Commit.

### Task P4.6 — `useOptimistic` for comment reactions `[L/M]` (ux)

**Files:** `src/features/comments/ui/comment-reactions.tsx:52,101`.

**Problem:** `useOptimistic` unused app-wide; reactions hand-roll `useState`+rollback and blanket-disable buttons during in-flight requests (`if (!canReact || pending) return` at 52; `disabled` at 101), so a second axis can't toggle until the first resolves.

- [ ] **Step 1:** Use `useOptimistic` inside the transition so toggles queue; drop the blanket pending-disable. Commit.

### Task P4.7 — Converge ad-hoc `useState(pending)` onto a primitive `[L/M]` (dx)

> ⏸️ **DEFERRED by validation pass.** A blanket `useTransition().isPending` swap is NOT behavior-neutral (`notification-list-actions` shares one flag across 2 buttons; `media-upload-form` deliberately splits `busy` from router-transition pending); `ConfirmDialog` already covers delete buttons; an `<ActionButton>` lands in frozen `ui/`. Revisit only as a deliberate foundation PR, auditing each migrated site to preserve its distinct pending source. Low value — defensible to skip.


**Files:** `src/components/ui/submit-button.tsx:7-14` (the `useFormStatus` idiom, 33 files) vs ~34 hand-rolled `useState(pending)` components (`forms/ui/form-fill.tsx`, `media/ui/media-upload-form.tsx`, delete buttons, toggles).

**Problem:** Two anti-double-submit idioms coexist; the manual ones re-implement disable + busy-text with slightly different copy. (Verifier: `ConfirmDialog` already covers delete buttons — scope to the genuinely ad-hoc ones.)

- [ ] **Step 1:** Where a component calls `createAction` directly (not via `<Form>`), prefer `useTransition`'s `isPending`, or add an `<ActionButton onAction>` UI primitive owning pending/disabled/busy-label. Commit.

### Task P4.8 — Rewrite README as a real onboarding doc `[L/S]` (dx)

**Files:** `README.md` (verbatim create-next-app), add `CONTRIBUTING.md` (none exists).

**Problem:** README tells contributors localhost:3000 (actual 3001), edit `app/page.tsx` (actual `src/app/`), Geist/Vercel (actual Docker) — wrong on the first step. Never mentions pnpm-only, feature slices, RBAC, or `docs/frontend-conventions.md`.

- [ ] **Step 1:** Rewrite: pnpm-only (link `.npmrc` rationale), port 3001, `pnpm lint && pnpm test && pnpm build` gate, pointers to CLAUDE.md + conventions + `_template/`, the `generate:api` workflow, real Docker deploy. Commit.

### Task P4.9 — Resolve the Prettier mandate + add `.editorconfig` `[L/S]` (dx)

**Files:** `.vscode/settings.json:3` (mandates `esbenp.prettier-vscode`), `package.json` (no prettier dep), `eslint.config.mjs` (no stylistic rules).

**Problem:** `.vscode` forces Prettier formatOnSave but there's no prettier dep, config, `.editorconfig`, or `format` script → diverging whitespace diffs with nothing in CI to catch them.

- [ ] **Step 1:** Pick one: add prettier devDep + `.prettierrc` + `format`/`format:check` scripts + CI check, **or** drop the `.vscode` Prettier mandate and rely on ESLint `--fix`. Add `.editorconfig` either way. Commit.

### Task P4.10 — Archive the 47 one-shot plans `[L/S]` (dx)

**Files:** `docs/superpowers/plans/` (47 dated logs, 2.9 MB), keep live specs in `docs/superpowers/specs/`.

**Problem:** Completed single-use plans intermix with load-bearing specs; the stale `package-lock.json` frozen-zone text is copy-pasted across a dozen (project is pnpm). Zero inbound references — orphaned. Dilutes signal.

- [ ] **Step 1:** Move completed plans to `docs/superpowers/archive/`; keep specs still referenced from conventions. Add a short index of canonical vs historical. (This plan stays in `plans/`.) Commit.

### Task P4.11 — Fold/remove `todo.md` `[L/S]` (dx)

**Files:** `todo.md` (repo root — 3 Russian iOS web-API scratch notes).

**Problem:** Ownerless scratch in prime root real estate, signals "work tracking lives here" when it doesn't.

- [ ] **Step 1:** Fold the 3 platform-gap notes into a "Known platform gaps" section in docs (or a GitHub issue) and delete `todo.md`. Commit.

### Task P4.12 — Pin `swagger2openapi` + document `generate:api` `[L/S]` (dx)

**Files:** `package.json:11` (`pnpm dlx swagger2openapi …`), README/CONTRIBUTING.

**Problem:** `dlx` fetches `swagger2openapi` fresh + unpinned every run (slow, a new major could silently change `schema.ts`); the sibling-checkout path `../philosophy-api/...` is documented nowhere.

- [ ] **Step 1:** Pin `swagger2openapi` as a devDep, call via `pnpm exec`; document the regen workflow (sibling-repo assumption, `SWAGGER_URL` override, coordination) next to the `schema.ts` frozen-zone note. Commit.

### Task P4.13 — Delete dead `statistics/client.ts` stub + template note `[L/S]` (cleanliness)

**Files:** Delete `src/features/statistics/client.ts` (unmodified `_template` copy, zero consumers). Add a checklist line to `_template/README.md` to delete `client.ts` when no `"use client"`/offline consumer needs it.

- [ ] **Step 1:** Remove the file; update the template checklist. `pnpm lint && pnpm build`; commit.

### Task P4.14 — Extract VAPID base64url codec out of the UI component `[L/S]` (cleanliness)

**Files:** Move `urlBase64ToUint8Array` from `preferences/ui/push-subscription-toggle.tsx:9-21` into `preferences/vapid.ts` + colocated `vapid.test.ts`.

**Problem:** A pure framework-agnostic codec lives inline in a `"use client"` UI component, untested in isolation — against the slice convention (pure helpers → slice-root module with colocated test).

- [ ] **Step 1:** TDD `vapid.ts`; import into the component. `pnpm lint && pnpm test`; commit.

### Task P4.15 — Remove the unused `react-yandex-metrika` dependency `[L/S]` (perf)

**Files:** `package.json:40`. Real integration is hand-rolled in `components/yandex-metrika/yandex-metrika.tsx` (imports nothing from the package).

**Problem:** Declared as a production dep with zero imports — dead weight, unmaintained against React 19.

- [ ] **Step 1:** Remove from `dependencies`; `pnpm install` (lockfile update — note: only this dep), `pnpm lint && pnpm build`; commit.

---

## Appendix A — Rejected findings (do NOT re-litigate)

The verification pass rejected these 9 with counter-evidence. Recorded so we don't resurface them:

1. **"Adopt `src/api/types.ts` alias layer consistently"** — Wrong premise: all 20 slices uniformly narrow their own entity via raw `components["schemas"]`; `types.ts` correctly hosts only cross-cutting shared types for slice-external infra. *Salvage:* prune ~16 dead aliases + fix the header doc (low-S).
2. **"Deduplicate four `'private'|'public'` visibility narrowings"** — The split faithfully mirrors the backend's per-struct field types; consolidating would make the FE diverge from the schema. No change.
3. **"Tags registry missing AUDIT/STATISTICS/SEARCH/NOTIFICATIONS"** — No invalidation bug (those slices don't use `unstable_cache`); rationale is already documented per-slice in each `api.ts`. No change. (`statistics` does have a mutation but is tag-less because per-user — also documented.)
4. **"blocks-JSON validation errors silently swallowed"** — False: in Zod 4 a field-level `.transform()` auto-scopes the issue to `path:['blocks']`, which `FormField name="blocks"` renders. No current bug. (P2.6 still worth doing for dedup, not for this.)
5. **"Add route-level `error.tsx` to every public segment"** — Root `error.tsx` already renders inside the layout (nav not wiped). *Salvage:* the real defect is cosmetic `min-h-screen` → `min-h-[40vh]` in 2 files (captured in P1.3).
6. **"Lazy-load the canvas editor"** — The edit route's sole content IS the editor (no pre-interaction window); `ssr:false` dynamic can't apply to the async Server Component. No change. (Tiptap on the lecture page IS worth splitting — that's P1.6.)
7. **"images.unoptimized flag"** — Non-finding by the reviewer's own admission: intentional + documented (offline + content-addressed `<img>`). No action.
8. **"Failed offline writes unsurfaced; no GC"** — Real code facts but the write path is dormant; fold into offline-WRITE slice A on resume (the queue-blocking half is captured in P3.8). Not a current task.
9. **"Export-link components leak internal API base URL"** — Not a security issue: those endpoints are public + documented as direct-link; `API_URL` is the public backend host every call uses. *Salvage:* the 2 hardcoded `API_URL` fallbacks are captured in P2.12; the prod-no-backend issue is a global deploy concern (P0.5), not a per-component fix.

## Appendix B — Stats & provenance

- Workflow run: `wf_911f84a6-b6e` (93 agents, ~3M tokens, 14 dimensions). 78 raw → **69 confirmed** (3 high, 28 medium, 38 low) → 9 rejected.
- 4 critical items (P0.1–P0.4) independently re-verified by hand against the source.
- Full per-finding detail (problem/fix/verifier notes) archived in the workflow output; this plan is the durable, deduplicated execution view.

---

## Self-Review

- **Coverage:** All 69 confirmed findings are mapped to a task across the 5 phases (a11y 6, architecture 3, consolidation 6, data-fetching 4, dx-tooling 8, forms-validation 5, offline 6, performance 2, rsc-next 5, security 2, styling 8, testing 7, typescript 4, ux-states 3). Several merge where they describe the same primitive (P2.1 ← 5 findings; P2.2 ← 3; P2.3/P2.5/P2.6 ← 2 each; P1.1 ← 2; P4.1 ← 2). VAPID appears once (P0.3) though flagged by both security + dx dimensions.
- **Note on granularity:** This is a master backlog. Foundation-zone tasks (🧊) intentionally carry concrete-but-not-final code direction — each gets a focused `writing-plans` sub-plan with full TDD steps at execution time, because they touch frozen zones and need a coordinated PR + a short design pass.
- **Ordering invariant:** Phase 0 before refactors (correct base); Phase 2 primitives before Phase 3 tests (tests get cheaper/uniform); Phase 1 is independent and high-ROI, can interleave.

---

## Appendix C — per-task validation revisions

Corrections from the 2026-06-16 validation pass (`wf_48742d3f-673`). **Read the entry for a task before executing it** — it supersedes the task body where they differ. Format: **P-ID** (finding #, verdict): correction.

### Phase 1

- **P1.1** (#9, revise): Ship per-segment `loading.tsx` with INLINE `<Skeleton>` markup (drop the shared `components/shared` helper — frozen). Prioritize public-CONTENT segments that DON'T auth-redirect: lectures, documents, glossary, trails index, search. Auth-gated segments (notifications, me/*, trails/my) `redirect('/login')` for logged-out users → skeleton flashes before bounce; skip or accept. `/search` gets a Suspense (P1.7), not a route `loading.tsx`.
- **P1.2** (#10, revise): Per-section fallback, not blanket Skeleton: `fallback={null}` (or tiny placeholder) for maybe-empty sections (LectureDocumentsSection / LectureMediaSection / DocumentContainers return null/own-empty → a Skeleton would flash-then-vanish = CLS); real `<Skeleton>` only for always-substantial (CommentSection, AnnotationsSection). Import `Skeleton` from `ui` (no edit). Suspense catches promises, NOT errors — don't oversell resilience.
- **P1.3** (#12, revise): A segment `error.tsx` catches the WHOLE segment (incl. the detail fetch) — it can't isolate one section. Step 1: segment `error.tsx` with `min-h-[40vh]`, shared markup in a co-located client component (NOT frozen `ui/`). Step 2 (separate PR): per-section Suspense + a new shared `ErrorBoundary`. Drop the "root error.tsx wipes the chrome" claim (already corrected).
- **P1.4** (#15, GO): Correct. `forms/[id]/submissions` keeps `getSubmissionsByForm` sequential (gated behind `canListFormSubmissions`); only `getMe` + `getXById` parallelize.
- **P1.5** (#7, revise): Keep the 3 swaps; ADDITIONALLY migrate `lectures/page.tsx` + `admin/lectures/page.tsx` (`pickInt` → `parsePaging`, delete the helper, keep `pickString`). Correct the finding text: `admin/tags`'s real issue is trailing-garbage truncation, not negatives.
- **P1.6** (#36, revise): Split ALL three comment-editor sites (create/reply/edit) via a shared lazy client wrapper (`next/dynamic` `ssr:false` inside a thin client component — can't `ssr:false` inside the async Server Component). Not just CommentCreateForm.
- **P1.7** (#11, revise): Create `src/features/search/ui/search-results-skeleton.tsx`, export via `index.ts` (deep imports blocked). The Suspense `key={`${q}|${type??''}|${offset??0}`}` is ESSENTIAL (router.replace in a transition keeps the old subtree). Keep `SearchBody`'s internal try/catch.
- **P1.8** (#13, revise): The single Suspense wrapper does NOT stream per-card (still awaits all N) → don't present it as a fix. Prioritize the backend batch-tags endpoint (blocked). Interim: leave as-is (cheap parallel public GETs) OR a per-card async tags slot each in its own `<Suspense>` (changes the LectureCard prop contract).
- **P1.9** (#16, revise): Step 1 backend ask is already filed → mark "awaiting backend". Interim: do NOT paginate the scan (makes the over-fetch WORSE); leave the single limited fetch with the documented `>100` cap comment, or rely on the button's optimistic self-heal. Ship NO code change until the backend `subscribed` flag lands.

### Phase 2 (all 🧊 — coordinated foundation PRs)

- **P2.1** (#4/22/27/63 + ux, revise): NOT one primitive — see cross-cutting rule 5. (a) `toastActionError(toast, result, {action, forbiddenTitle?, failureTitle?})` for ~34 imperative sites; (b) `<ActionFormError/>`/`<FormFeedback result forbiddenAction successText/>` for the ~13–20 inline-JSX `<p>`-triad forms (`forbiddenAction` REQUIRED prop, success uses `text-(--color-description)`, `role=alert`/`status`); (c) `actionErrorMessage(result, action)` in CLIENT-SAFE `src/utils/action-message.ts` (NOT server-only `api-error.ts`). Exclude toast/ERROR_TEXT(login)/`<span>`-footer sites. Don't couple to `--color-danger` (P2.2). Suspended-distinction needs a `create-action.ts` contract change first — don't bundle.
- **P2.2** (#64/65/68, revise): Tokens (#64): define `--color-danger`, `--color-danger-bg` (red-50 tint), `--color-danger-fill` + `--color-danger-fill-hover` (the button 600/700 pair — don't collapse it), `--color-success` in BOTH `:root` AND dark `@media` AND forced-colors, with REAL values (NOT `@theme`-only — that's the P0.1 bug). Replace ALL usages incl. the 3 missed (green-700 `media-card:33`, `textarea:18`, `toaster:26` red-500). Focus-ring (#65): keep BOTH `FOCUS_RING_INPUT` (offset-0) + `FOCUS_RING_CONTROL` (offset-2) — the offset difference is deliberate, not a de-dup target; `SHELL_BASE` = only the shared prefix, each component keeps its sizing (`cn` has no tailwind-merge). Theme-color (#68): fix BOTH `layout.tsx` (`#f8f8f8`→`#f6f2eb`) AND `src/manifest.template.json:7-8`, then re-run the generator (don't hand-edit the generated `public/manifest.webmanifest`); manifest `theme_color` is single-valued.
- **P2.3** (#3/62, revise): Keep the unified kit `Pagination` a SERVER component preserving params via a caller-supplied `searchParams`/`buildHref` prop — NOT internal `usePathname`/`useSearchParams` hooks (that client-ifies all ~12 server-component consumers). Keep the no-arg path backward-compatible; preserve the `offset===0` DELETE branch AND the `total===0` → "0 из 0" empty-state (the forks have it; the kit's "1–0 из 0" is a silent regression). Delete the 5 clones; fix the false docstring.
- **P2.4** (#8, revise): The FORM owns field/sentinel/base policy. Hook returns `{navigate, pending}`; `navigate` takes a caller-built `URLSearchParams` (or a `buildParams` callback) + optional base override. Do NOT auto-read FormData or hardcode `resetParams:[offset]` (search-input/share-lookup build fresh empty params; audit-filter has an `all` sentinel; comment-search keeps offset; lecture-search uses an injected basePath). Drop manual `useCallback` (React Compiler on). One PR migrating all forms together.
- **P2.5** (#18/21, revise): Scope `unwrapList` to the ~17 canonical 4-field list fetchers; comments uses `subtrees` → a thin wrapper or a separate `unwrapItemsTotal`; leave `lectures/api:261/285` narrowing casts alone. Add `unwrap(data)→data.data??null` for single-object fetchers. Remove `data.data as T` casts per-site gated by `pnpm build`; PRESERVE the ~5–6 load-bearing casts (`media/actions:39` null-strip, `lectures/actions:261/285` + `trails/api:122` reshape, `tags/actions:99` widen) — let the type error be the signal. Do #18's cast removal WITHIN this migration so files aren't edited twice.
- **P2.6** (#19/23, revise): Factory `blocksJsonField({allowEmpty?, messages?})` parameterizing non-empty AND the Russian messages; type the output via ONE internal cast — frame as "one audited cast instead of 8", NOT end-to-end safety. Do NOT pass explicit `path:['blocks']` — Zod 4 auto-scopes; hardcoding mis-keys non-blocks fields (trails `lecture_ids`, tags `tag_ids`, forms `payload`) to a phantom `blocks` key. Apply ONLY to the 6 array-of-blocks decoders (documents, glossary, events, banners, comments, annotations); leave anchor/canvas/forms/trails/tags. Resolve the glossary/events/banners empty-array question with backend. `as never` removal (#19) depends on the factory typing landing first — don't split across PRs.
- **P2.7** (#17, revise→maybe-drop): Do NOT add `assertOk` (reinvents `rethrowApiError`, drops `error.error`+code, edits frozen `api-error.ts`). At each of the 3 sites cast into the existing helper: `if (error as ApiError | undefined) rethrowApiError(error as ApiError, '<fallback>')`. Leaving the 3 documented eslint-disables as-is is a defensible drop (low/DX).
- **P2.8** (#20, revise): Do NOT widen `rethrowApiError`'s signature — uncast `error` ALREADY type-checks (probed 10 endpoints). In feature action files ONLY, delete the redundant `as ApiError`; EXCLUDE the frozen `ast-editor/pickers` casts; verify `banners:130` with `tsc`. Per-site, no blanket sed. (Reduces this from a frozen-zone PR to feature edits.)
- **P2.9** (#6, revise): TWO sibling helpers — `requireActiveUserOrRedirect(next)` for the 10 active-only pages, and `requireUserOrRedirect(next)` (guards `!me` only, returns possibly-suspended `Me`) for the 4 suspended-allowed pages (settings, me/stats, me/annotations, notifications). Active-only on those would lock suspended users out of their own pages. Keep `encodeURIComponent`.
- **P2.10** (#24, GO): Put `toRfc3339` + `DATE_ONLY` in a NEW `src/utils/datetime-form.ts` (NOT appended to the unrelated media-duration `format-time.ts`); keep it pure (no server-only).
- **P2.12** (#5, revise): PIECE 1 (do now, NO frozen zone): in `comment-export-links.tsx` + `search-export-links.tsx` replace the inline `process.env.API_URL ?? "http://localhost:8080"` with `import { API_URL } from "@/api/client"` (glossary already does this). PIECE 2 (optional foundation): `ExportLinks` needs a `wrapper?: 'span'|'p'` prop (6 use `<span>`, glossary+search use `<p>`) + per-caller `className`. Treat PIECE 2 as nice-to-have, unbundled.
- **P2.13** (#67, revise): Prefer a class-recipe export `chipClass({interactive?})` (mirrors `button.tsx`'s Record-lookup; project has only `cn`, no `cva`) applied to each existing element (RouterLink/span/li) — preserves DOM + hover placement. Scope to the 4 border-pill sites; exclude search-results/media filled badges. A full component must support `asChild`/element override.
- **P2.15** (#0, revise): Scope the shared isomorphic view to ONLY cover+title+date (`LectureHeaderView`, plain props); leave tags + description rendered per-consumer (clickable RouterLink + glossary online; plain text offline) — sharing them dead-links tags offline and fires the `suggestGlossaryTerms` server action on an offline page. ~6 lines of payoff → "defer until a 3rd consumer" is also defensible.

### Phase 3

- **P3.1** (#46, revise): Per-slice `actions-rbac.test.ts` using REAL permissions (no `vi.mock("./permissions")`); stub `getMe` to guest/suspended/insufficient; for OWNER-AWARE actions ALSO stub the slice `getById` to return a resource so the GATE (not the 404 path) rejects; assert `{success:false, code:"forbidden"}` + the mutating verb wasn't called. Drop the "assert correct helper" part (covered by `permissions.test.ts`). Prioritize highest-blast-radius admin actions.
- **P3.2** (#47, revise): Calibrate revalidate assertions per-action — import `{Tags}`: assert `(Tags.LECTURES, id)` AND `(Tags.LECTURES)` (DOUBLE call) for update/setVisibility, `(Tags.LECTURES)` only for create/delete, and assert NOT called for notifications (no revalidate). For error mapping, assert the branded `ActionResult` (relying on the already-tested rethrow helpers), not the full code→text map. Start with one lectures exemplar.
- **P3.3** (#51, revise): N small per-slice tests cloning `create-comment-idempotency.test.ts`, NOT one shared abstraction (different verbs/permission mocks/input shapes; createAction vs createFormAction). Prioritize `createAnnotation` (raw-fetch header spread — highest drop risk) + `submitForm`. EXCLUDE `setUserRole`/`setUserStatus`/`subscribe`/`markRead` (not in the 27-endpoint rollout — asserting a header there asserts a falsehood).
- **P3.4** (#48, revise): Forms have NO optlock branch — "обновите страницу" lives in `api-error` DEFAULT_MESSAGES via the generic `!code` branch (drop that wording). Add ONE smoke test first confirming `<Form errors=>` renders `Field.Error` in jsdom, then assert: validation → field error; `{code:forbidden}` → branded text NOT raw error (highest value, guards the CLAUDE.md invariant); generic `{!code,error}` → echoes `state.error`. Optionally add a VERSION_MISMATCH case to `api-error.test.ts`.
- **P3.5** (#49, revise): DROP the "tag passed to `unstable_cache` matches the revalidate tag" assertion — it's tautological (both reference the same `Tags.*` symbol) and `unstable_cache` isn't observable under jsdom. Keep the high-value mapping/branch tests modeled on `canvas/api.test.ts` (notifications degrade branches, 404→null/[], pagination defaults). Tag wiring, if worried, is covered once at the action level (P3.2).
- **P3.6** (#50, revise): Foundation PR. Step 1 MEASURE: run `pnpm test:coverage`. Step 2 config: v8, `json-summary`, `all:true`, `include src/**/*.{ts,tsx}` with excludes (schema.ts, *.test.*, _template) so new untested files count as 0%. Step 3 thresholds at-or-below the measured baseline (ratchet — green first run). Drop the `src/utils` per-dir floor. Frame honestly: prevents backsliding, doesn't "fix untested mutations".
- **P3.7** (#52, revise): Keep Part 1 (render `error.tsx`/`admin error.tsx`, assert fallback + `reset()`); DROP the "route forbidden()/notFound() to the right shell" assertion (file-convention routing, not unit-assertable). Treat `global-error.tsx` as a separate design-coordinated change (renders its own `<html><body>`, overlaps the frozen root shell).
- **P3.8** (#38, revise → DEFER to slice A): Cap only genuine poison: `next = attempts+1`; if `>= MAX(~20)` write `status:failed` + continue, else keep `pending` + break. Also gate `drain` on `navigator.onLine` (separate small change) so a long-offline device isn't dead-lettered into silent data loss. Add a `drain.test.ts` dead-letter case.
- **P3.9** (#42, GO): Get+put in ONE `readwrite` tx; include `await tx.done` on the record-absent skip path. Offline path dormant (not user-facing today).
- **P3.10** (#39, revise → DEFER to slice A): Pick Web Locks (the only option that actually closes the race): wrap `drainOutbox` in `navigator.locks.request(..., {ifAvailable:true})`, injectable via `DrainDeps` for jsdom, fallback to today's module guard when `navigator.locks` is undefined. Drop the `claimedAt`-age alternative (heuristic, breaks the recovery test, adds a frozen schema field).
- **P3.11** (#43, revise → DEFER): Drop the speculative migration ladder + "version outbox" (IDB versions the whole DB, not a store). Add ONLY `blocking(){ db.close(); }` (+ optional `blocked`/`terminated` console.warn) on `openDB`; comment that the v2 ladder must be authored in the same PR that bumps `OFFLINE_DB_VERSION`.
- **P3.12** (#40, revise): Capture the registration in a holder; checker calls `update().catch(noop)` only when visible; `setInterval` + `focus` + `visibilitychange`; cleanup clears the interval AND both listeners. Frozen `src/hooks` → own PR.
- **P3.13** (#41, revise): Hash-derive ONLY — in `scripts/generate-sw-assets.mjs` replace `Date.now()` with `createHash('sha256').update(swTemplate + inlinedLogic).digest('hex').slice(0,10)` (after `inlinedLogic` is built). File stays committed, stops churning unless SW source changes. Drop the gitignore/prebuild path (`next dev` never runs the generator → 404 in dev). `scripts/` is not frozen.

### Phase 4

- **P4.1** (#30/35, revise): `useId()` listbox id + per-option ids; an EFFECT that sets `aria-controls`/`aria-activedescendant` on `editor.view.dom` while open and REMOVES them on cleanup/close (`editorProps.attributes` is static — can't react), re-run on `[open, safeActive, cmds.length, id, editor]`. Drop the "wrap the region" alternative. Fold the open-announcement (#35) into THIS one deliverable — the activedescendant bridge IS the announcement; do not also ship a separate `aria-live` node (double-voice). Keep the existing `role=status` empty branch.
- **P4.2** (#31, GO): Always-mounted polite region + sr-only text; SSR `getServerSnapshot=true` to avoid a hydration mismatch; keep `aria-hidden` on the icon. No frozen files.
- **P4.3** (#32, revise): Branch the direction word by axis via a tested helper `axisValueAriaLabel(axis,v)`: agreement → согласен/не согласен; quality → высокое/низкое качество; insight → "отметить как инсайт". `aria-label = `${axisLabel(axis)}: ${axisValueAriaLabel(axis,v)}``. The single согласен/не согласен formula is wrong for quality/insight.
- **P4.4** (#33, revise): Scope to the AtMenu wrapper ONLY (RefMenu is shared with RefPopover, which already owns focus/Escape). Keep `role=dialog` (tests stay green). Add `onKeyDown` Escape → `closeAtSuggestion` + `editor.commands.focus()`; move initial focus to the first category button via an AtMenu-only ref. NO Tab trap. Leave shared RefMenu + the RefPopover path untouched.
- **P4.5** (#34, revise): NOW: correct the `canvas-editor` comment (lines 324-331) that overclaims a "full interactive contract" + add a tracked a11y-limitation note. LATER (behind a design pass, only if canvas un-defers): roving focus via a focusable overlay (not a bare `<g>`), Tab traverse / arrows nudge (disambiguated), Enter select, explicit edge mode, focus synced to reducer selection.
- **P4.6** (#29, revise): `useOptimistic(myReactions, (s,patch)=>patch)`; gate only on `!canReact` (drop the pending disable); apply optimistic FIRST then await; KEEP `setError` on failure (no manual rollback); carry the `exactOptionalPropertyTypes`-safe rebuild into the reducer; `axisCount` stays non-optimistic (out of scope).
- **P4.8** (#56, GO): Do NOT claim Geist is unused (it IS wired in `layout.tsx`). State ports precisely: dev 3001, container/`next start` 3000.
- **P4.9** (#55, revise): Pick Option B (severity low/effort S): remove the Prettier mandate from `.vscode/settings.json` (the file is 100% that mandate → delete or set `{}`). No frozen zones, no CI, no whole-tree reflow. `.editorconfig` optional. Enforced formatting = a separate deliberate foundation PR.
- **P4.10** (#59, revise): Naive `git mv` breaks 2 live spec→plan refs (`backend-coverage-program-design.md:14,76` cite the AST phase-2 template) — exempt or update them in the same commit. Fold `docs/plans/` into the scheme; add a one-line index + a status-header convention. Treat the package-lock→pnpm-lock CLAUDE.md correction SEPARATELY (frozen). Defer is legitimate (no inbound link broken today).
- **P4.11** (#60, revise): `todo.md` is TRACKED → `git rm todo.md` + commit. Create a short "Known platform gaps (iOS web APIs)" subsection near the offline specs (vibrate, setAppBadge, File System Access). Add only the new docs file by name (no `git add -A`).
- **P4.12** (#58, revise): Standalone foundation/chore PR (`package.json` + `pnpm-lock.yaml`). Pin `swagger2openapi` to an EXPLICIT version (a caret still drifts) with the lock committed; `pnpm dlx` → `pnpm exec` (mirrors `openapi-typescript`). Document the regen workflow (sibling-repo assumption, `SWAGGER_URL` override, schema.ts coordinated/frozen) in README near the conventions §6 note. Review the one-time `schema.ts` diff deliberately.
- **P4.13** (#1, GO): Delete the stub; keep `_template/client.ts` (the scaffold source). Guardrail-4 ESLint is a files-glob block, never requires `client.ts`. The README-checklist addition is well-targeted.
- **P4.14** (#2, GO): Straightforward — move `urlBase64ToUint8Array` to `preferences/vapid.ts` + a colocated `vapid.test.ts`; no frozen zone.
- **P4.15** (#37, revise): Standalone foundation PR: remove the `react-yandex-metrika` dependency line AND run `pnpm install` to update `pnpm-lock.yaml`, commit both (frozen `package.json`; `--frozen-lockfile` CI drifts otherwise). No source change.
