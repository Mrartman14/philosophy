# Forms: Native `required` → Server Zod Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server-side Zod the single source of truth for form validation by removing native HTML `required` from kit controls (swap to `aria-required`), aligning the codebase with Base UI's official "Using with Zod" idiom and eliminating browser-localized (English-on-`ru`) native validation messages.

**Architecture:** Base UI `<Form>` already renders `<form noValidate>` and, when no field is client-invalid and the project submits via a server action (`useActionState` + `action` prop, **not** `onFormSubmit`), it does **not** `preventDefault` — so the React server action fires and the server Zod runs. Removing the HTML `required` attribute removes the only client-side constraint, routing every empty/invalid submit to the (already-localized) server schema; its `fieldErrors` flow back through the `<Form errors>` prop into `<Field.Error>`. We preserve accessibility by swapping `required` → `aria-required` on each control (pure ARIA, no constraint validation). The kit `FormField` is **unchanged**: its existing `Field.Validity` localization of `valueMissing` becomes a dormant net (never fires for migrated text controls) that still covers the two deferred file-input forms.

**Tech Stack:** Next.js (App Router, server actions), Base UI (`@base-ui/react` 1.4.1), Zod, next-intl, Vitest + Testing Library, pnpm.

## Global Constraints

- Communicate with the user in Russian; `src/` file/folder names are kebab-case.
- Parallel agents: **never** run destructive git (`stash`/`reset`/`checkout .`/`clean`), never `git add -A`/`git add .` — stage only your own files by name; pass this rule to any sub-subagent.
- Toolchain is **pnpm** (never npm). Gate before any commit/PR: `pnpm lint && pnpm test && pnpm build` all green.
- Frozen zones touched here, intentionally and minimally: `src/components/ui/*` is **NOT** modified by the core tasks (kit stays as-is); `docs/frontend-conventions.md` is updated. No change to `src/api/schema.ts`, `eslint.config.mjs`, `package.json`, root/admin shell.
- **Zero schema changes.** All 30 in-scope fields were verified to already reject empty input server-side with a localized message (`common.titleRequired`, `tags.nameRequired`, `events.startDateRequired`, `banners.startAtRequired`, `tokens.labelRequired`, `pushSend.titleRequired`, `forms.promptRequired`, lecture `date` regex `lectures.dateFormat`, etc.). Do **not** edit any `schemas.ts`.
- Swap semantics: replace the HTML `required` attribute on the **control** with `aria-required` (i.e. `required` → `aria-required`). Do **not** touch the `required` prop on the wrapping `<Field>`/`<FormField>` (that renders the asterisk and is the typed-form contract).

## Scope

**IN (30 control sites, 20 files) — swap `required` → `aria-required`:**
Two sub-groups, handled identically (swap) but with different residual behavior:
- **Text controls (clean):** after the swap, no native validity state ever fires; validation is 100% server Zod. Most fields.
- **Native typed controls (`type="datetime-local"` in banners; dynamic `type="date"|"datetime-local"` in events; `ColorInput` in banners):** the swap removes the *presence* (`valueMissing`) constraint, but the input **type** can still raise `badInput`/`typeMismatch` on a malformed partial entry. That residual native message is localized by the **optional** kit hardening (Task 12); without it, only the rare malformed-partial case shows a browser string (empty/normal cases are fully server-driven). Note: lecture `date` is a plain text `TextInput` (placeholder `2026-04-27`, server regex) — it is a *text* control, not a typed one.

**DEFER (2 file inputs) — keep native `required`, follow-up:**
`documents/ui/document-upload-form.tsx:29` and `media/ui/media-upload-form.tsx:69` (`<input type="file" required>`). Multipart uploads; "no file chosen" does not map cleanly to a per-field localized server error. They keep native `required` and remain covered by the kit `FormField` `valueMissing` localization (renders «Заполните это поле»). Out of scope here; see "Follow-up".

**EXCLUDE (8 sites) — domain data, untouched:**
`src/features/forms/**` user-generated-form fields (`form-builder*.tsx`, `form-field-input.tsx`, `form-fill.tsx`, `submission-edit-form.tsx`): `required` there is a form-author property / end-user-form-fill attribute, a different validation domain. **Exception:** `forms/ui/form-builder.tsx:104` is the *builder's own title* input (admin metadata, server Zod) and **is** an IN-scope swap.

## File Map

| File | Change | Lines (pre-swap) |
|---|---|---|
| `docs/frontend-conventions.md` | Document the convention | ~198–228 |
| `src/features/auth/ui/login-form.tsx` | swap ×2 | 46, 51 |
| `src/features/auth/ui/register-form.tsx` | swap ×3 | 47, 52, 59 |
| `src/features/canvas/ui/canvas-create-form.tsx` | swap ×1 | 48 |
| `src/features/canvas/ui/canvas-edit-form.tsx` | swap ×1 | 66 |
| `src/features/lectures/ui/lecture-create-form.tsx` | swap ×2 | 38, 42 |
| `src/features/lectures/ui/lecture-edit-form.tsx` | swap ×2 | 51, 55 |
| `src/features/documents/ui/document-create-form.tsx` | swap ×1 | 34 |
| `src/features/documents/ui/document-meta-form.tsx` | swap ×1 | 37 |
| `src/features/glossary/ui/glossary-create-form.tsx` | swap ×1 | 36 |
| `src/features/tags/ui/tag-create-form.tsx` | swap ×1 | 32 |
| `src/features/tags/ui/tag-admin-row.tsx` | swap ×1 | 62 |
| `src/features/trails/ui/trail-create-form.tsx` | swap ×1 | 29 |
| `src/features/trails/ui/trail-meta-form.tsx` | swap ×1 | 36 |
| `src/features/tokens/ui/tokens-manager.tsx` | swap ×1 | 95 |
| `src/features/preferences/ui/push-send-form.tsx` | swap ×1 | 45 |
| `src/features/forms/ui/form-builder.tsx` | swap ×1 (title only) | 104 |
| `src/features/banners/ui/banner-create-form.tsx` | swap ×2 (color, datetime) | 53, 72 |
| `src/features/banners/ui/banner-edit-form.tsx` | swap ×2 (color, datetime) | 72, 94 |
| `src/features/events/ui/event-create-form.tsx` | swap ×2 (title, date) | 42, 60 |
| `src/features/events/ui/event-edit-form.tsx` | swap ×2 (title, date) | 83, 107 |
| `src/components/ui/form-field.tsx` | **optional** Task 12 only | — |
| `src/i18n/messages/{ru,en}/common.ts` | **optional** Task 12 only | — |

> Line numbers are from the 2026-06-23 audit; verify the `required` token in context before each edit (other edits may have shifted lines). Each swap is the literal control attribute `required` (standalone, inside a `<TextInput>`/`<ColorInput>`/`<input type=…>` element), **not** the `required` on the enclosing `<Field>`.

---

### Task 1: Document the convention

**Files:**
- Modify: `docs/frontend-conventions.md` (the forms section, around lines 217–228)

**Interfaces:**
- Produces: the written rule every later task aligns to (no native `required` on controls; `aria-required` for a11y; server Zod is the single source).

- [ ] **Step 1: Add the convention note**

In `docs/frontend-conventions.md`, immediately after the paragraph ending `…нет зарегистрированного контрола).` (the block describing native-проводка, ~line 228), insert:

```markdown

**Валидация — серверный Zod, НЕ нативный `required`.** На контролах (`TextInput`/
`Textarea`/`ColorInput`/native `<input>`) НЕ ставим HTML-атрибут `required`: Base UI
читает `element.validationMessage` (строку, локализованную по языку БРАУЗЕРА, не
UI-локали) и режет сабмит на клиенте, минуя серверную Zod-валидацию с локализованными
сообщениями. Идиома Base UI (док «Using with Zod») — источник истины это схема: пустой
сабмит уходит в server action, Zod возвращает `fieldErrors`, они текут через `errors`-проп
в `<Field.Error>`. Для доступности на required-контроле ставим `aria-required` (чистый
ARIA, без constraint-validation). Обязательность визуально — звёздочка из `<Field required>`.
Исключения: (1) `<input type="file">` загрузок (multipart) пока сохраняет нативный
`required`; (2) native typed-инпуты (`type="datetime-local"|"date"|"number"`) по природе
типа всё равно могут поднять `badInput`/`typeMismatch` — это покрывает kit `FormField`
(локализация `Field.Validity`).
```

- [ ] **Step 2: Verify the doc example already matches (no code change)**

Confirm the example at ~line 198–200 already shows `<Field name="title" … required>` with a bare `<TextInput />` (no control `required`). It does — the convention was already documented; the code is what drifted.

- [ ] **Step 3: Commit**

```bash
git add docs/frontend-conventions.md
git commit -m "docs(forms): зафиксировать валидацию через серверный Zod, aria-required вместо native required"
```

---

### Task 2: auth slice (login, register) — text controls

**Files:**
- Modify: `src/features/auth/ui/login-form.tsx` (control `required` at 46, 51)
- Modify: `src/features/auth/ui/register-form.tsx` (control `required` at 47, 52, 59)
- Test: `src/features/auth/ui/login-form.test.tsx` (create if absent) or extend existing auth form test

**Interfaces:**
- Consumes: convention from Task 1.
- Produces: pattern (`required` → `aria-required` on control) reused by Tasks 3–11.

- [ ] **Step 1: Write the failing test (render asserts aria-required, not required)**

Add to the auth login form test (mock `@/i18n/client` per existing slice tests; mock the action). Minimal assertion:

```tsx
it("required-контролы несут aria-required и НЕ несут native required", () => {
  render(<LoginForm />); // with whatever providers/mocks the slice test already uses
  const username = screen.getByLabelText(/Логин|Username/i);
  expect(username).toHaveAttribute("aria-required", "true");
  expect(username).not.toBeRequired();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/features/auth/ui/login-form.test.tsx`
Expected: FAIL (`username` currently has native `required`, not `aria-required`).

- [ ] **Step 3: Swap `required` → `aria-required` on the controls**

`login-form.tsx` line 46: `<TextInput required autoComplete="username" />` → `<TextInput aria-required autoComplete="username" />`. Line 51 (password): `required` → `aria-required`.
`register-form.tsx` lines 47, 52, 59: each control `required` → `aria-required`. Leave every `<Field … required>` untouched.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/features/auth/ui/login-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/ui/login-form.tsx src/features/auth/ui/register-form.tsx src/features/auth/ui/login-form.test.tsx
git commit -m "refactor(auth): native required → aria-required (валидация через серверный Zod)"
```

---

### Tasks 3–11: per-slice swaps (same recipe as Task 2)

Each task = one slice, identical mechanical recipe: **(a)** for one representative form in the slice add/extend a test asserting a required control has `aria-required` and `not.toBeRequired()`; **(b)** run it red; **(c)** swap every listed control `required` → `aria-required` (leave `<Field required>` alone); **(d)** run green; **(e)** commit only the slice's files. Use the slice's existing test mocks (`@/i18n/client`, server action) — copy the pattern from neighboring slice tests.

- [ ] **Task 3 — canvas:** `canvas-create-form.tsx:48`, `canvas-edit-form.tsx:66`. Commit msg: `refactor(canvas): native required → aria-required`.
- [ ] **Task 4 — lectures:** `lecture-create-form.tsx:38,42`, `lecture-edit-form.tsx:51,55` (all text controls; `date` is a text input). Commit: `refactor(lectures): native required → aria-required`.
- [ ] **Task 5 — documents:** `document-create-form.tsx:34`, `document-meta-form.tsx:37`. (Do NOT touch `document-upload-form.tsx` — deferred file input.) Commit: `refactor(documents): native required → aria-required`.
- [ ] **Task 6 — glossary + tags:** `glossary-create-form.tsx:36`, `tag-create-form.tsx:32`, `tag-admin-row.tsx:62`. Commit: `refactor(glossary,tags): native required → aria-required`.
- [ ] **Task 7 — trails:** `trail-create-form.tsx:29`, `trail-meta-form.tsx:36`. Commit: `refactor(trails): native required → aria-required`.
- [ ] **Task 8 — tokens + preferences:** `tokens/ui/tokens-manager.tsx:95`, `preferences/ui/push-send-form.tsx:45`. Commit: `refactor(tokens,preferences): native required → aria-required`.
- [ ] **Task 9 — forms builder (title only):** `forms/ui/form-builder.tsx:104` only. **Do NOT** touch the 8 EXCLUDE_DOMAIN sites (`form-builder-field-row.tsx`, `form-field-input.tsx`, `form-fill.tsx`, `submission-edit-form.tsx`, and the `field.required`/`emptyField`/payload-map lines in `form-builder.tsx`). Commit: `refactor(forms): builder-title native required → aria-required`.
- [ ] **Task 10 — banners (typed: color, datetime-local):** `banner-create-form.tsx:53,72`, `banner-edit-form.tsx:72,94`. Note these are native typed controls — the swap removes the presence constraint; residual `badInput` is covered by Task 12 (or accepted). Commit: `refactor(banners): native required → aria-required`.
- [ ] **Task 11 — events (title text + date typed):** `event-create-form.tsx:42,60`, `event-edit-form.tsx:83,107`. Commit: `refactor(events): native required → aria-required`.

For each: end by confirming the slice's existing tests stay green (`pnpm exec vitest run src/features/<slice>`).

---

### Task 12 (OPTIONAL — typed-input hardening): localize residual native states in the kit

Only needed to guarantee **zero** browser-English for the ~6 native typed controls (banners datetime/color, events date) on malformed partial entry (`badInput`/`typeMismatch`/range). If the team accepts that rare residual, skip this task.

**Files:**
- Modify: `src/components/ui/form-field.tsx` (extend the existing `Field.Validity` branch)
- Modify: `src/i18n/messages/ru/common.ts`, `src/i18n/messages/en/common.ts` (add `field.invalid`)
- Test: `src/components/ui/form.test.tsx` (add a `badInput`/typeMismatch localization case)

**Interfaces:**
- Consumes: existing `FormField` `Field.Validity` block and `common.field.required`.
- Produces: `common.field.invalid` localized message shown for any non-`valueMissing` native validity state.

- [ ] **Step 1: Add i18n key (ru then en)**

`ru/common.ts` under the existing `field:` object: add `invalid: "Введите корректное значение",`.
`en/common.ts` mirror: `invalid: "Please enter a valid value",`.

- [ ] **Step 2: Write the failing test**

In `src/components/ui/form.test.tsx`, add (reuses the existing namespace-aware mock). Use a real `type="email"` + invalid value → produces a genuine `typeMismatch` validity state in jsdom (no `setCustomValidity` stand-in, which would set `customError` — a flag the FormField condition deliberately does not list):

```tsx
it("native typeMismatch (не valueMissing) показывает локализованный generic, не браузерный текст", async () => {
  render(
    <Form aria-label="em">
      <FormField name="email" label="Почта" required>
        <TextInput type="email" aria-required defaultValue="not-an-email" />
      </FormField>
      <button type="submit">OK</button>
    </Form>,
  );
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  await waitFor(() => {
    expect(screen.getByText("Введите корректное значение")).toBeInTheDocument();
  });
  // browser-native English string must NOT leak
  expect(screen.queryByText(/valid email|fill (in|out)/i)).toBeNull();
});
```

- [ ] **Step 3: Run it red**

Run: `pnpm exec vitest run src/components/ui/form.test.tsx`
Expected: FAIL (currently the non-`valueMissing` branch renders the bare `<Field.Error/>` = native string).

- [ ] **Step 4: Extend FormField's `Field.Validity`**

Replace the current branch body so it is:

```tsx
const t = useT("common");
// …
<Field.Validity>
  {(v) => {
    const nv = v.validity;
    if (nv.valueMissing) {
      return (
        <Field.Error match="valueMissing" className="text-xs text-(--color-danger)">
          {t("field.required")}
        </Field.Error>
      );
    }
    const otherNative =
      nv.badInput || nv.typeMismatch || nv.patternMismatch ||
      nv.stepMismatch || nv.rangeOverflow || nv.rangeUnderflow ||
      nv.tooLong || nv.tooShort;
    if (otherNative) {
      return (
        <Field.Error match={true} className="text-xs text-(--color-danger)">
          {t("field.invalid")}
        </Field.Error>
      );
    }
    return <Field.Error className="text-xs text-(--color-danger)" />;
  }}
</Field.Validity>
```

- [ ] **Step 5: Run green**

Run: `pnpm exec vitest run src/components/ui/form.test.tsx`
Expected: PASS (both the existing `valueMissing` test and the new `badInput` test).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/form-field.tsx src/i18n/messages/ru/common.ts src/i18n/messages/en/common.ts src/components/ui/form.test.tsx
git commit -m "feat(ui): локализовать остаточные native validity-состояния (badInput/typeMismatch) в FormField"
```

---

### Task 13: Final verification + regression guard

**Files:**
- Test/guard: a grep assertion (run manually or as a tiny test) + full gate.

- [ ] **Step 1: Confirm no kit-control retains native `required` outside the allowlist**

Run:
```bash
grep -rnE '<(TextInput|Textarea|ColorInput|Select)\b[^>]*\brequired\b' src/features --include="*.tsx" | grep -v test
```
Expected: **no output** (every kit control swapped). The only remaining native `required` are the two `<input type="file" required>` (deferred) and the `forms/**` domain sites — verify with:
```bash
grep -rnE '\brequired\b' src/features --include="*.tsx" | grep -v test | grep -vE '<Field |FormField' | grep -vE 'forms/ui/(form-builder|form-field-input|form-fill|submission-edit)' 
```
Expected: only `document-upload-form.tsx` and `media-upload-form.tsx` file inputs.

- [ ] **Step 2: Full gate**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 3: Manual browser QA (record results)**

On `pnpm dev` (:3001, admin `dev/admin12345`): for one text form (e.g. `/canvases/new`) and one typed form (e.g. banner create), submit empty → confirm the localized **server** error appears under the field (no browser-native English popup or inline English), and the asterisk + screen-reader `aria-required` are present. Note outcomes in the PR description.

- [ ] **Step 4: Commit (if Step 1 added a guard file) / open PR**

```bash
git add -- <only guard file if created>
git commit -m "test(forms): guard — нет native required на kit-контролах вне allowlist"
```

---

## Follow-up (separate, out of scope)

- **File-input uploads** (`document-upload-form.tsx`, `media-upload-form.tsx`): give the multipart upload actions a localized per-field "file required" `fieldError` (mapped to `name="file"`), then swap their `required` → `aria-required` and they too become fully server-driven. Until then they keep native `required` + kit `valueMissing` localization.

## Self-Review

1. **Spec coverage:** every IN-scope file from the audit (20 files / 30 swaps) has a task (2–11); docs (1); optional typed-input hardening (12); verification + deferred-allowlist guard (13). DEFER and EXCLUDE sets are explicitly named so they are not touched.
2. **Placeholder scan:** swaps are concrete (`required` → `aria-required` at named files/lines); Task 12 shows full replacement code; tests show real assertions. No TBD/"handle edge cases".
3. **Type consistency:** no new types introduced; `aria-required` is a standard DOM attr forwarded by `TextInput`/`ColorInput` (rest props → `Field.Control` → `<input>`); `common.field.invalid` mirrors the existing `common.field.required` shape; `Field.Validity` render-prop `v.validity` keys (`badInput`, `typeMismatch`, …) match Base UI `FieldValidityData['state']`.
4. **Zero schema edits** reconfirmed — every required field already rejects empty with a localized message.
