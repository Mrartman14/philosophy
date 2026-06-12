# AST Editor — Phase 2a — Image vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять image-блок до полноценного — upload через `POST /api/uploads/images`, NodeView с alt/caption inline-редактированием, paste/drop захват картинок, resolution `storage_key → URL` через env-driven helper.

**Architecture:** Server action оборачивает upload (берёт cookie через `createApiClient`-pattern, форвардит `multipart/form-data`). Tiptap-плагин ловит paste/drop с `image/*` файлами и вызывает action; на ответ `{storage_key}` вставляет валидный image-блок. NodeView (через `@tiptap/react` `ReactNodeViewRenderer`) рисует `<figure><img/><figcaption contenteditable/></figure>` и редактирует alt/caption inline. Storage-URL — `${NEXT_PUBLIC_STORAGE_URL ?? NEXT_PUBLIC_API_URL}/static/files/${storage_key}` (см. design §6.5 / §9 — оставляет space для перехода на schema-driven без breaking change).

**Tech Stack:** Next.js server actions (`"use server"`), `@tiptap/react` ReactNodeViewRenderer, ProseMirror plugin (paste/drop handlers), msw для тестов upload.

---

## Parallel-safety contract

Этот план собирается в собственном worktree параллельно с **2b (Pickers)** и **2c (Toolbar/Polish)**. Файлы, которых касается ТОЛЬКО этот план:

- Модифицирует:
  - `src/components/ast-editor/extensions/nodes/image.ts` — добавляет NodeView + parseHTML/renderHTML.
  - `src/components/ast-editor/extensions/index.ts` — дописывает один `imagePasteDropPlugin` в массив плагинов (если `image` ∈ allowedBlocks).
- Создаёт (только новые файлы — collision невозможен):
  - `src/components/ast-editor/upload/storage-url.ts`
  - `src/components/ast-editor/upload/upload-image.ts` (server action)
  - `src/components/ast-editor/upload/upload-image.test.ts`
  - `src/components/ast-editor/upload/__fixtures__/png-1x1.ts`
  - `src/components/ast-editor/extensions/image-paste-drop-plugin.ts`
  - `src/components/ast-editor/extensions/image-paste-drop-plugin.test.ts`
  - `src/components/ast-editor/extensions/nodes/image-node-view.tsx`
  - `src/components/ast-editor/extensions/nodes/image.test.ts`

**НЕ трогает** (резервируется за параллельными планами):

- `src/components/ast-editor/ast-editor.tsx` — 2c.
- `src/components/ast-editor/use-ast-editor.ts` — 2c.
- `src/components/ast-editor/index.ts` (public re-exports) — никто из трёх не дополняет (image API внутренний).
- `src/components/ast-editor/toolbar/*` — 2c.
- `src/components/ast-editor/pickers/*` — 2b.

**Frozen zones** (по `CLAUDE.md`): `src/api/schema.ts`, `src/utils/*`, `src/components/ui/*`, `package.json` — не трогать.

**Параллельная работа агентов** (CLAUDE.md): запрещены `git stash/reset/checkout./clean`, `git add -A/.`, перезапись чужих изменений. Все коммиты — `git add` по именам файлов.

---

## Файловая структура (создаётся этим планом)

```
src/components/ast-editor/
├── upload/
│   ├── storage-url.ts                        # resolveStorageUrl(storage_key)
│   ├── upload-image.ts                       # "use server" action, FormData → /api/uploads/images
│   ├── upload-image.test.ts                  # msw fixture: 201/401/413/422
│   └── __fixtures__/
│       └── png-1x1.ts                        # base64 1×1 PNG для тестов
└── extensions/
    ├── image-paste-drop-plugin.ts            # PM Plugin: handleDrop/handlePaste для image/*
    ├── image-paste-drop-plugin.test.ts
    └── nodes/
        ├── image.ts                          # MODIFIED: + addNodeView, parseHTML, renderHTML
        ├── image.test.ts                     # NEW: парсинг HTML, сохранение attrs round-trip
        └── image-node-view.tsx               # React NodeView: figure/img/figcaption
```

---

## Task 1: storage-url helper

**Files:**
- Create: `src/components/ast-editor/upload/storage-url.ts`
- Test: добавить в `src/components/ast-editor/upload/upload-image.test.ts` (Task 3) — отдельного теста не нужно, helper тривиальный.

**Why this exists:** spec §6.5 — base host для `/static/files/<storage_key>` отличается dev↔prod. MVP — env-driven с дефолтом на API-host. Helper изолирует этот выбор: если бэк позже начнёт отдавать `static_files_base` через `/api/ast/schema`, заменим тело helper'а без изменений NodeView.

- [ ] **Step 1: Создать helper**

```ts
// src/components/ast-editor/upload/storage-url.ts

/**
 * URL для image src, где `storage_key` — SHA256-hex content-address файла.
 * Используется image NodeView и любыми future-консьюмерами AST image-блока.
 *
 * MVP — env-driven с фолбэком на API host. Spec §6.5 / §9 допускают
 * переход на schema-driven (поле в /api/ast/schema) без breaking change
 * для NodeView — точка изменения локализована здесь.
 */
export function resolveStorageUrl(storageKey: string): string {
  if (!storageKey) return "";
  const base =
    process.env["NEXT_PUBLIC_STORAGE_URL"] ??
    process.env["NEXT_PUBLIC_API_URL"] ??
    "";
  return `${base}/static/files/${storageKey}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ast-editor/upload/storage-url.ts
git commit -m "feat(ast-editor): add storage-url helper for image src resolution"
```

---

## Task 2: 1×1 PNG fixture

**Files:**
- Create: `src/components/ast-editor/upload/__fixtures__/png-1x1.ts`

- [ ] **Step 1: Создать фикстуру (валидный PNG byte-signature)**

```ts
// src/components/ast-editor/upload/__fixtures__/png-1x1.ts

/**
 * Минимальный валидный PNG (1×1 прозрачный пиксель). Используется в тестах
 * upload — http.DetectContentType на бэке полагается на magic bytes; этот
 * блок гарантированно сниффится как `image/png`.
 */
const BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function makePngFile(name = "test.png"): File {
  const bin = atob(BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: "image/png" });
}

export function makePngBlob(): Blob {
  const bin = atob(BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ast-editor/upload/__fixtures__/png-1x1.ts
git commit -m "test(ast-editor): add 1x1 PNG fixture for upload tests"
```

---

## Task 3: upload-image server action

**Files:**
- Create: `src/components/ast-editor/upload/upload-image.ts`
- Test: `src/components/ast-editor/upload/upload-image.test.ts`

**Why server action, not client fetch:** auth — JWT в httpOnly cookie. Клиентский `fetch` не может его прочесть, чтобы поставить `Authorization: Bearer …`. Server action → читает cookie через `createApiClient`-pattern → форвардит `multipart/form-data` на API. Возвращает `ActionResult<{ storage_key, upload_id }>` в стиле существующих actions (`src/utils/create-action.ts`).

**Why raw fetch, not openapi-fetch:** `openapi-fetch` плохо умеет multipart/form-data (требует body-serializer override и теряет тип). Тут чище через нативный `fetch` + явный `Authorization`.

**Errors mapping** (бэк-коды → action codes):
- `IMAGE_TOO_LARGE` (413) → `code: "image_too_large"`
- `IMAGE_INVALID_MIME` (422) → `code: "image_invalid_mime"`
- 401 → `code: "forbidden"` (через `ForbiddenError`)
- остальное → generic `error`

- [ ] **Step 1: Написать failing test**

```ts
// src/components/ast-editor/upload/upload-image.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { uploadImage } from "./upload-image";
import { makePngFile } from "./__fixtures__/png-1x1";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "fake-jwt" }) }),
}));

// API_URL по умолчанию — http://localhost:8080 (см. src/api/client.ts)
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("uploadImage server action", () => {
  it("201 → success { storage_key, upload_id }", async () => {
    server.use(
      http.post("http://localhost:8080/api/uploads/images", async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer fake-jwt");
        const fd = await request.formData();
        expect(fd.get("file")).toBeInstanceOf(File);
        return HttpResponse.json(
          { upload_id: "u-1", storage_key: "abc123" },
          { status: 201 },
        );
      }),
    );

    const fd = new FormData();
    fd.set("file", makePngFile());
    const res = await uploadImage(fd);

    expect(res).toEqual({
      success: true,
      data: { storage_key: "abc123", upload_id: "u-1" },
    });
  });

  it("413 IMAGE_TOO_LARGE → code: image_too_large", async () => {
    server.use(
      http.post("http://localhost:8080/api/uploads/images", () =>
        HttpResponse.json(
          { code: "IMAGE_TOO_LARGE", error: "too large" },
          { status: 413 },
        ),
      ),
    );

    const fd = new FormData();
    fd.set("file", makePngFile());
    const res = await uploadImage(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("image_too_large");
  });

  it("422 IMAGE_INVALID_MIME → code: image_invalid_mime", async () => {
    server.use(
      http.post("http://localhost:8080/api/uploads/images", () =>
        HttpResponse.json(
          { code: "IMAGE_INVALID_MIME", error: "only image/* allowed" },
          { status: 422 },
        ),
      ),
    );

    const fd = new FormData();
    fd.set("file", new File(["bogus"], "x.txt", { type: "text/plain" }));
    const res = await uploadImage(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("image_invalid_mime");
  });

  it("401 → code: forbidden", async () => {
    server.use(
      http.post("http://localhost:8080/api/uploads/images", () =>
        HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
      ),
    );

    const fd = new FormData();
    fd.set("file", makePngFile());
    const res = await uploadImage(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("forbidden");
  });

  it("missing file → validation error", async () => {
    const res = await uploadImage(new FormData());
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест — должен провалиться (action не существует)**

Run: `npx vitest run src/components/ast-editor/upload/upload-image.test.ts`
Expected: FAIL — `Cannot find module './upload-image'`

- [ ] **Step 3: Реализовать action**

**Why not `createAction`:** обёртка из `src/utils/create-action.ts` (frozen-zone) принимает только `ForbiddenError` → `code: "forbidden"` и сворачивает остальные ошибки в generic `{ success: false, error }` без поля `code`. Нам нужно различать `image_too_large` / `image_invalid_mime` для UX-toast'ов, поэтому формируем `ActionResult`-shape вручную (без падения через throw — все ветки возвращают объект).

```ts
// src/components/ast-editor/upload/upload-image.ts
"use server";
import "server-only";
import { cookies } from "next/headers";

const API_URL = process.env["API_URL"] ?? "http://localhost:8080";

export type UploadImageResult =
  | { success: true; data: { storage_key: string; upload_id: string } }
  | { success: false; error: string; code: "forbidden" | "image_too_large" | "image_invalid_mime" }
  | { success: false; error: string; code?: undefined };

interface ApiError { code?: string; error?: string }

export async function uploadImage(formData: FormData): Promise<UploadImageResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "file is required" };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/uploads/images`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Сетевая ошибка" };
  }

  if (res.status === 201) {
    const body = (await res.json()) as { storage_key: string; upload_id: string };
    return { success: true, data: body };
  }

  let body: ApiError = {};
  try { body = (await res.json()) as ApiError; } catch { /* */ }

  if (res.status === 401 || res.status === 403) {
    return { success: false, error: body.error ?? "Нет доступа", code: "forbidden" };
  }
  if (res.status === 413 || body.code === "IMAGE_TOO_LARGE") {
    return { success: false, error: body.error ?? "Изображение слишком большое (макс 10 MiB)", code: "image_too_large" };
  }
  if (res.status === 422 || body.code === "IMAGE_INVALID_MIME") {
    return { success: false, error: body.error ?? "Неподдерживаемый формат файла", code: "image_invalid_mime" };
  }
  return { success: false, error: body.error ?? `Ошибка загрузки: ${res.status}` };
}
```

- [ ] **Step 5: Запустить тесты — все 5 кейсов проходят**

Run: `npx vitest run src/components/ast-editor/upload/upload-image.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/upload/upload-image.ts src/components/ast-editor/upload/upload-image.test.ts
git commit -m "feat(ast-editor): add upload-image server action with 401/413/422 error mapping"
```

---

## Task 4: Image NodeView (React)

**Files:**
- Create: `src/components/ast-editor/extensions/nodes/image-node-view.tsx`

**Why React NodeView:** alt и caption — inline-редактируемые. Голый `parseHTML/renderHTML` не даёт interactivity без forceUpdate-цикла. `ReactNodeViewRenderer` (`@tiptap/react`) даёт `updateAttributes()` доступ из компонента и автоматически прокидывает selection.

**UX контракт:**
- `<figure data-ast-image>` обёртка.
- `<img src=resolveStorageUrl(storage_key) alt={alt} />` — клик в редактор-режиме делает image selected (PM делает за нас).
- `<figcaption contentEditable={editable} ...>` под картинкой — pure-text редактор alt+caption через 2 input'а в overlay (или альтернатива: alt — отдельная input[aria-label="alt"], caption — figcaption).
- Если `storage_key === ""` (стейт «загружается») — render placeholder skeleton, без `<img>` (валидность attrs гарантирует attr-плагин).

**MVP simplification:** alt/caption редактируются через 2 input-поля под картинкой (видны при selection). Это проще чем contentEditable figcaption и не путает PM с inline-content внутри атомарной ноды (`atom: true`).

- [ ] **Step 1: Реализация**

```tsx
// src/components/ast-editor/extensions/nodes/image-node-view.tsx
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { resolveStorageUrl } from "../../upload/storage-url";

export function ImageNodeView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const editable = editor.isEditable;
  const storageKey = (node.attrs["storage_key"] as string) ?? "";
  const alt = (node.attrs["alt"] as string) ?? "";
  const caption = (node.attrs["caption"] as string) ?? "";

  return (
    <NodeViewWrapper as="figure" data-ast-image="" data-selected={selected || undefined}>
      {storageKey ? (
        <img src={resolveStorageUrl(storageKey)} alt={alt} />
      ) : (
        <div role="presentation" aria-label="Загрузка изображения" />
      )}

      {editable && selected && (
        <div contentEditable={false} className="ast-image-fields">
          <label>
            <span>alt</span>
            <input
              type="text"
              value={alt}
              maxLength={1000}
              onChange={(e) => updateAttributes({ alt: e.target.value })}
            />
          </label>
          <label>
            <span>caption</span>
            <input
              type="text"
              value={caption}
              maxLength={1000}
              onChange={(e) => updateAttributes({ caption: e.target.value })}
            />
          </label>
        </div>
      )}

      {!editable && caption ? <figcaption>{caption}</figcaption> : null}
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 2: Commit (без тестов — RTL для NodeView добавляется в Task 6)**

```bash
git add src/components/ast-editor/extensions/nodes/image-node-view.tsx
git commit -m "feat(ast-editor): add React image NodeView with inline alt/caption editing"
```

---

## Task 5: Wire NodeView into ImageExt + parseHTML/renderHTML

**Files:**
- Modify: `src/components/ast-editor/extensions/nodes/image.ts`
- Test: `src/components/ast-editor/extensions/nodes/image.test.ts`

**Что меняем:**
- `parseHTML` — должен читать `data-storage-key`, `data-alt`, `data-caption`, `data-block-id` из `<figure data-ast-image>`.
- `renderHTML` — для read-only режима (когда NodeView не активен). Серверный SSR-render тоже должен дать смысленный HTML.
- `addNodeView` — `ReactNodeViewRenderer(ImageNodeView)`.

- [ ] **Step 1: Failing test для parse/render round-trip**

```ts
// src/components/ast-editor/extensions/nodes/image.test.ts
import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode, DOMSerializer, DOMParser as PMDOMParser } from "@tiptap/pm/model";
import { ImageExt } from "./image";
import { ParagraphExt } from "./paragraph";

describe("ImageExt parseHTML/renderHTML", () => {
  const schema = getSchema([ParagraphExt, ImageExt]);

  it("renderHTML emits data-storage-key/alt/caption/block-id", () => {
    const node = schema.nodes["image"]!.create({
      storage_key: "abc",
      alt: "alpha",
      caption: "cap",
      blockId: "b-1",
    });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
    const wrap = document.createElement("div");
    wrap.appendChild(dom);
    const fig = wrap.querySelector("figure[data-ast-image]")!;
    expect(fig.getAttribute("data-storage-key")).toBe("abc");
    expect(fig.getAttribute("data-alt")).toBe("alpha");
    expect(fig.getAttribute("data-caption")).toBe("cap");
    expect(fig.getAttribute("data-block-id")).toBe("b-1");
  });

  it("parseHTML round-trips storage_key/alt/caption/blockId", () => {
    const html = `<figure data-ast-image data-storage-key="def" data-alt="bb" data-caption="ccap" data-block-id="b-2"></figure>`;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const parsed = PMDOMParser.fromSchema(schema).parse(wrap);
    let imageNode: PMNode | null = null;
    parsed.descendants((n) => {
      if (n.type.name === "image") imageNode = n;
    });
    expect(imageNode).not.toBeNull();
    expect(imageNode!.attrs["storage_key"]).toBe("def");
    expect(imageNode!.attrs["alt"]).toBe("bb");
    expect(imageNode!.attrs["caption"]).toBe("ccap");
    expect(imageNode!.attrs["blockId"]).toBe("b-2");
  });
});
```

- [ ] **Step 2: Прогнать тест — fail (текущий ImageExt не парсит attrs)**

Run: `npx vitest run src/components/ast-editor/extensions/nodes/image.test.ts`
Expected: FAIL — атрибуты undefined / пустые.

- [ ] **Step 3: Расширить ImageExt**

```ts
// src/components/ast-editor/extensions/nodes/image.ts (REPLACE)
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "./image-node-view";

/**
 * AST `image` block. Atomic (no inline content). attrs:
 *   - storage_key: hex64 (required, validated by attr-plugin)
 *   - alt: ≤1000 chars
 *   - caption: ≤1000 chars
 *   - blockId: top-level Block ID
 *
 * NodeView is React-driven: alt/caption are edited via overlay inputs while
 * the node is selected (figcaption stays out of PM content model — node is
 * `atom: true` to keep AST round-trip clean).
 */
export const ImageExt = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      storage_key: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-storage-key") ?? "",
        renderHTML: (attrs: { storage_key?: string }) =>
          attrs.storage_key ? { "data-storage-key": attrs.storage_key } : {},
      },
      alt: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-alt") ?? "",
        renderHTML: (attrs: { alt?: string }) =>
          attrs.alt ? { "data-alt": attrs.alt } : {},
      },
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") ?? "",
        renderHTML: (attrs: { caption?: string }) =>
          attrs.caption ? { "data-caption": attrs.caption } : {},
      },
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-ast-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-ast-image": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
```

- [ ] **Step 4: Прогнать тест — PASS**

Run: `npx vitest run src/components/ast-editor/extensions/nodes/image.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Перезапустить весь test-suite — pm-schema/round-trip остаются зелёными**

Run: `npm test -- --run`
Expected: все тесты по-прежнему проходят (NodeView не ломает PM-schema).

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/extensions/nodes/image.ts src/components/ast-editor/extensions/nodes/image.test.ts
git commit -m "feat(ast-editor): wire React NodeView and parse/render attrs into ImageExt"
```

---

## Task 6: NodeView render test (RTL + jsdom)

**Files:**
- Append to: `src/components/ast-editor/extensions/nodes/image.test.ts`

**Why:** verify рендер NodeView в actual editor instance (поверх unit-теста parseHTML/renderHTML из Task 5).

- [ ] **Step 1: Дописать тест**

```ts
// дополнение к src/components/ast-editor/extensions/nodes/image.test.ts
import { Editor } from "@tiptap/core";
import { render, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { EditorContent } from "@tiptap/react";

afterEach(cleanup);

describe("ImageNodeView", () => {
  it("renders <img> with resolved storage URL", async () => {
    const editor = new Editor({
      extensions: [ParagraphExt, ImageExt],
      content: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { storage_key: "abc", alt: "hello", caption: "" },
          },
        ],
      },
    });

    const { container } = render(<EditorContent editor={editor} />);
    // tick — NodeView mounts on next frame
    await new Promise((r) => setTimeout(r, 0));

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("hello");
    expect(img!.getAttribute("src")).toContain("/static/files/abc");

    editor.destroy();
  });

  it("shows skeleton when storage_key is empty", async () => {
    const editor = new Editor({
      extensions: [ParagraphExt, ImageExt],
      content: {
        type: "doc",
        content: [{ type: "image", attrs: { storage_key: "" } }],
      },
    });
    const { container } = render(<EditorContent editor={editor} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[aria-label='Загрузка изображения']")).not.toBeNull();
    editor.destroy();
  });
});
```

- [ ] **Step 2: Прогнать тест — должен пройти**

Run: `npx vitest run src/components/ast-editor/extensions/nodes/image.test.ts`
Expected: PASS (4 tests total)

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/nodes/image.test.ts
git commit -m "test(ast-editor): RTL render test for image NodeView"
```

---

## Task 7: image paste/drop PM plugin

**Files:**
- Create: `src/components/ast-editor/extensions/image-paste-drop-plugin.ts`
- Test: `src/components/ast-editor/extensions/image-paste-drop-plugin.test.ts`

**Behavior:**
- `handleDrop(view, event, slice, moved)` — ловим, если `event.dataTransfer.files` содержит хотя бы один `image/*`. Если содержит — `event.preventDefault()`, для каждого файла вызываем `uploadImage(formData)` и при успехе вставляем `{ type: "image", attrs: { storage_key, alt: "", caption: "", blockId: "" } }` на позиции drop.
- `handlePaste(view, event)` — то же самое для `event.clipboardData.files`.
- Если апроад вернул error — `console.warn` с сообщением + toast (toast скипуем для MVP — оставим только лог + noop). Действие не применяется.
- Если выделение пустое — вставка между блоков. Если внутри параграфа — split + insert.

**Constraints:**
- Plugin не подгружается, если `image` не в allowed blocks (см. Task 8 — wiring conditional).
- Upload асинхронный — мы НЕ блокируем ProseMirror транзакцию. Вместо этого сразу вставляем skeleton-ноду с `storage_key=""`, после ответа делаем `tr.setNodeMarkup` на тот же pos. Skeleton-ноду фильтрует attr-plugin (storage_key required) — поэтому МЫ ОБХОДИМ attr-plugin через метатег.

**Решение проще:** не вставляем skeleton. Ждём ответ → вставляем готовую ноду. Иначе skeleton-vs-attr-plugin конфликт сложнее, чем он того стоит для MVP. UX: «при drop курсор «думает» 0.5–2 сек, потом картинка появляется».

- [ ] **Step 1: Failing test (paste с image/* файлом → upload вызывается)**

```ts
// src/components/ast-editor/extensions/image-paste-drop-plugin.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Editor } from "@tiptap/core";
import { ParagraphExt } from "./nodes/paragraph";
import { ImageExt } from "./nodes/image";
import { createImagePasteDropPlugin } from "./image-paste-drop-plugin";
import { Extension } from "@tiptap/core";
import { makePngFile } from "../upload/__fixtures__/png-1x1";

vi.mock("../upload/upload-image", () => ({
  uploadImage: vi.fn(async () => ({
    success: true,
    data: { storage_key: "abc-key", upload_id: "u-1" },
  })),
}));

import { uploadImage } from "../upload/upload-image";

const wrap = Extension.create({
  name: "wrap",
  addProseMirrorPlugins() { return [createImagePasteDropPlugin()]; },
});

describe("imagePasteDropPlugin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("paste with image file → uploads and inserts image block", async () => {
    const editor = new Editor({ extensions: [ParagraphExt, ImageExt, wrap] });

    const file = makePngFile();
    const dt = new DataTransfer();
    dt.items.add(file);

    editor.view.dom.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
    );

    // wait for async upload
    await new Promise((r) => setTimeout(r, 0));

    expect(uploadImage).toHaveBeenCalledOnce();
    const json = editor.getJSON();
    const has = JSON.stringify(json).includes('"image"');
    expect(has).toBe(true);
    editor.destroy();
  });

  it("paste with non-image content → does nothing (lets PM handle text)", async () => {
    const editor = new Editor({ extensions: [ParagraphExt, ImageExt, wrap] });
    const dt = new DataTransfer();
    dt.setData("text/plain", "hello");

    editor.view.dom.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(uploadImage).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("upload failure → no image inserted", async () => {
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      error: "boom",
    });
    const editor = new Editor({ extensions: [ParagraphExt, ImageExt, wrap] });

    const dt = new DataTransfer();
    dt.items.add(makePngFile());

    editor.view.dom.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
    );

    await new Promise((r) => setTimeout(r, 0));
    const has = JSON.stringify(editor.getJSON()).includes('"image"');
    expect(has).toBe(false);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Запустить тест — fail (plugin не существует)**

Run: `npx vitest run src/components/ast-editor/extensions/image-paste-drop-plugin.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать plugin**

```ts
// src/components/ast-editor/extensions/image-paste-drop-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { uploadImage } from "../upload/upload-image";

export const imagePasteDropPluginKey = new PluginKey("ast-editor-image-paste-drop");

/**
 * Captures pasted/dropped image files, uploads them, and inserts an `image`
 * block at the drop / paste position. Async upload — we do NOT insert a
 * placeholder; user sees the result when the response comes back. Failures
 * are logged via console.warn (no UI toast in MVP).
 *
 * Plugin is wired conditionally — only when `image` is in the allowed-block
 * set for the current entityContext (see extensions/index.ts).
 */
export function createImagePasteDropPlugin() {
  return new Plugin({
    key: imagePasteDropPluginKey,
    props: {
      handleDrop(view, event) {
        const files = collectImageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
          ?? view.state.selection.from;
        for (const file of files) void insertUploaded(view, file, pos);
        return true;
      },
      handlePaste(view, event) {
        const files = collectImageFiles(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.state.selection.from;
        for (const file of files) void insertUploaded(view, file, pos);
        return true;
      },
    },
  });
}

function collectImageFiles(list: FileList | undefined | null): File[] {
  if (!list || list.length === 0) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list.item(i);
    if (f && f.type.startsWith("image/")) out.push(f);
  }
  return out;
}

async function insertUploaded(view: EditorView, file: File, pos: number) {
  const fd = new FormData();
  fd.set("file", file);
  const res = await uploadImage(fd);
  if (!res.success) {
    console.warn("[ast-editor] image upload failed:", res.error);
    return;
  }
  const imageType = view.state.schema.nodes["image"];
  if (!imageType) return;
  const node = imageType.create({
    storage_key: res.data.storage_key,
    alt: "",
    caption: "",
    blockId: "",
  });
  const tr = view.state.tr.insert(pos, node);
  view.dispatch(tr);
}
```

- [ ] **Step 4: Прогнать — все 3 теста PASS**

Run: `npx vitest run src/components/ast-editor/extensions/image-paste-drop-plugin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/extensions/image-paste-drop-plugin.ts src/components/ast-editor/extensions/image-paste-drop-plugin.test.ts
git commit -m "feat(ast-editor): add paste/drop plugin uploading and inserting images"
```

---

## Task 8: Wire paste-drop plugin conditionally in buildExtensions

**Files:**
- Modify: `src/components/ast-editor/extensions/index.ts`

**Что меняем:** добавить `createImagePasteDropPlugin()` в массив plugins внутри `validation`-Extension'а — но только если `allowedBlocks.has("image")`.

- [ ] **Step 1: Изменение**

Найти блок `addProseMirrorPlugins()` в `validation`-Extension'е и добавить условие:

```ts
// src/components/ast-editor/extensions/index.ts (фрагмент)
import { createImagePasteDropPlugin } from "./image-paste-drop-plugin";
// …

const validation = Extension.create({
  name: "ast-validation",
  addProseMirrorPlugins() {
    const plugins = [
      createLimitsPlugin(snapshot, level),
      createAttrPlugin(snapshot),
      createDedupBlockIdPlugin(),
    ];
    if (allowedBlocks.has("image")) {
      plugins.push(createImagePasteDropPlugin());
    }
    return plugins;
  },
});
```

- [ ] **Step 2: Прогнать весь test-suite**

Run: `npm test -- --run`
Expected: все тесты PASS.

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-editor/extensions/index.ts
git commit -m "feat(ast-editor): wire image paste/drop plugin when image is allowed in context"
```

---

## Task 9: Manual smoke (если есть dev-окружение)

Не блокирующий (нет автоматизации в этом плане). Если dev-сервер доступен, проверить вручную:

- [ ] Drop PNG в editor с context=document → картинка вставляется (~1с задержка).
- [ ] Drop файла application/zip → ничего не вставляется, no error in console (handler return false).
- [ ] Paste из буфера обмена с картинкой → то же.
- [ ] Selection на image-блоке → появляются alt/caption inputs, ввод обновляет attrs.
- [ ] Запустить серверный API в режиме limit-bypass / залить файл >10MiB через DevTools → no insertion, console.warn `Изображение слишком большое (макс 10 MiB)`.

Если smoke невозможен — пометить тут «manual smoke deferred to consumer migration» и продолжать.

---

## Task 10: Final lint/test/build + push

- [ ] **Step 1: Финальные гейты**

Run: `npm run lint && npm test -- --run && npm run build`
Expected: все 3 зелёные.

- [ ] **Step 2: Создать PR**

Использовать `superpowers:finishing-a-development-branch` или `gh pr create`. Title: `feat(ast-editor): Phase 2a — image upload + NodeView`.

PR body checklist:
- [ ] Покрыто тестами: upload action (5 кейсов), NodeView render (2), parseHTML/renderHTML round-trip (2), paste/drop plugin (3).
- [ ] Frozen zones не тронуты (`git diff --name-only main...HEAD` не показывает `src/utils/`, `src/api/schema.ts`, `package.json`, `src/components/ui/`, `src/components/markdown-editor/`).
- [ ] No-conflict с 2b (pickers) — ни один файл не пересекается.
- [ ] No-conflict с 2c (toolbar) — ни один файл не пересекается.

---

## Self-review checklist

После всех 10 задач:

- [ ] `npm run lint && npm test -- --run && npm run build` — зелёное.
- [ ] `git diff --name-only main...HEAD` — только файлы из «Файловой структуры» этого плана + 2 модификации (`extensions/index.ts`, `extensions/nodes/image.ts`).
- [ ] `package.json` не модифицирован.
- [ ] `src/api/schema.ts` не модифицирован.
- [ ] Все ошибки `uploadImage` локализованы в action; компонент NodeView не делает HTTP сам.
- [ ] `resolveStorageUrl("")` возвращает пустую строку (не битый URL).
- [ ] Paste/drop срабатывает только если `image ∈ allowedBlocks` для текущего context'а.

## Что НЕ входит в этот план (закрывают параллельные планы / Phase 3+)

- Image toolbar-кнопка → Phase 2c (toolbar).
- UI-toast при upload-ошибке → Phase 2c или follow-up.
- Image picker (выбор из уже загруженных) → Phase 2b (если решим расширить).
- Schema-driven `static_files_base` → backend story, см. design §9.
- Drag-handle / resize image → future.
- Progress-bar во время upload → future.
- Crop / placeholder-skeleton-on-loading → future.
