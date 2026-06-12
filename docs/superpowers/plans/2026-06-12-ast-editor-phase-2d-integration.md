# AST Editor — Phase 2d — Integration + ast-render catch-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замкнуть цепочку 2a → 2b → 2c: image-кнопка в toolbar (через `uploadImage` из 2a), `@`-suggestion (открывает RefMenu из 2b), отключение canvas-picker'а (dormant, спека §4), прокид `defaultLectureId`, и догнать публичный рендер `ast-render` до того, что создаёт редактор: image-блоки по `storage_key` через общий `resolveStorageUrl` и марки `media_ref` / `comment_ref`.

**Architecture:** Все изменения — внутри незамороженных `src/components/ast-editor/` и `src/components/ast-render/`. ImageButton — toolbar-кнопка со скрытым `<input type="file">`, зовёт существующий server action `uploadImage` и вставляет `image`-блок; ошибки — через `useToast` (`@/components/ui`, root layout уже монтирует провайдер). `@`-suggestion — ProseMirror-плагин по образцу slash-menu (`toolbar/slash-menu-plugin.ts`) + React-компонент AtMenu, который рендерит существующий RefMenu; RefMenu получает новый опциональный hook `onWillInsert` для удаления `@`-маркера перед вставкой mark. ast-render переиспользует `resolveStorageUrl` прямым импортом из `@/components/ast-editor/upload/storage-url` (оба — shared-компоненты, ESLint-гарды ограничивают только `src/features/*`; файл не перемещаем, чтобы не трогать NodeView из 2a).

**Tech Stack:** Tiptap/ProseMirror plugins, `@base-ui/react/{toolbar,popover}`, `useToast` из `@/components/ui`, vitest + RTL + `vi.mock`.

---

## Предусловия и текущее состояние main (зафиксировано 2026-06-12, HEAD c7e0da3e)

Планы 2a/2b/2c **уже выполнены и смержены** в main. Отклонения от текстов их планов, которые этот план учитывает (при выполнении сверить по факту — Task 1):

1. **RefMenu-trigger в toolbar УЖЕ реализован** — polish-коммит `c909247a` добавил `src/components/ast-editor/toolbar/buttons/ref-popover.tsx` и подключил его в `toolbar.tsx`. Этот пункт из «Что НЕ входит» 2b/2c закрыт — Task 1 верифицирует, дублировать НЕ нужно. Но `defaultLectureId` через RefPopover НЕ прокинут — закрывает Task 4.
2. **Пикеры рефакторены** (коммит `e579ae49`): сигнатура `onSelect(id: string, label: string)` (не `onSelect(id)` как в тексте плана 2b). RefMenu при пустом выделении вставляет label как текст с mark.
3. **CanvasPicker ПОДКЛЮЧЁН в RefMenu** (план 2b его подключил). Спека программы (§4 «Вне скоупа», волна 1) требует canvas dormant — Task 5 фиксирует отклонение от 2b: категория `canvas` удаляется из RefMenu, файлы `pickers/canvas-picker.tsx`, его тест в `pickers.test.tsx` и `searchCanvases` в `pickers/actions.ts` **остаются** (dormant, не удалять).
4. **ast-render/nodes/image.tsx читает `attrs.src`** — такого атрибута у image-блока на беке нет. Бек (`philosophy-api/internal/ast/schema.go:162-169`): `storage_key` (required, ровно 64 hex-символа), `alt` (≤1000), `caption` (≤1000). Редактор (2a) создаёт блоки именно с `storage_key`.
5. `ast.MarkType` в `src/api/schema.ts` уже содержит `media_ref`, `comment_ref`, `canvas_ref` — типы менять не нужно, только рендер.

---

## Parallel-safety contract

Этот план выполняется в собственном worktree в волне 1. Другие фичи волны 1 (tags, events, banners, users-admin, audit, auth-register, glossary-enrichment, preferences-push) НЕ касаются `src/components/ast-editor/` и `src/components/ast-render/` — обе директории целиком **зарезервированы за этой фичей** на время волны.

**Создаёт (только новые файлы):**

- `src/components/ast-editor/toolbar/buttons/image-button.tsx`
- `src/components/ast-editor/toolbar/buttons/image-button.test.tsx`
- `src/components/ast-editor/pickers/at-suggestion-plugin.ts`
- `src/components/ast-editor/pickers/at-suggestion-plugin.test.ts`
- `src/components/ast-editor/pickers/at-menu.tsx`
- `src/components/ast-editor/pickers/at-menu.test.tsx`
- `src/components/ast-render/marks/media-ref.tsx`
- `src/components/ast-render/marks/comment-ref.tsx`

**Модифицирует:**

- `src/components/ast-editor/toolbar/toolbar.tsx` — ImageButton + `defaultLectureId`.
- `src/components/ast-editor/toolbar/toolbar.test.tsx` — новые гейтинг-кейсы.
- `src/components/ast-editor/toolbar/buttons/ref-popover.tsx` — прокид `defaultLectureId`.
- `src/components/ast-editor/pickers/ref-menu.tsx` — минус canvas, плюс `onWillInsert`.
- `src/components/ast-editor/pickers/ref-menu.test.tsx` — тесты на оба изменения.
- `src/components/ast-editor/ast-editor.tsx` — прокид `defaultLectureId`, atHost-extension, AtMenu.
- `src/components/ast-editor/README.md` — актуализация секций Phase 2.
- `src/components/ast-render/nodes/image.tsx` — `storage_key` → `resolveStorageUrl`.
- `src/components/ast-render/types.ts` — `renderMediaRef` / `renderCommentRef` в контексте.
- `src/components/ast-render/inline-renderer.tsx` — кейсы `media_ref` / `comment_ref`.
- `src/components/ast-render/__fixtures__/blocks.ts` — image-фикстуры на `storage_key`, новые ref-фикстуры.
- `src/components/ast-render/ast-render.test.tsx` — обновление image-тестов, новые mark-тесты.
- `src/components/ast-render/__snapshots__/ast-render.test.tsx.snap` — регенерация (vitest -u).

**НЕ трогает (dormant / чужое / frozen):**

- `src/components/ast-editor/pickers/canvas-picker.tsx`, `pickers/actions.ts`, `pickers/pickers.test.tsx` (тест CanvasPicker остаётся — компонент dormant, но компилируется и работает).
- `src/components/ast-editor/extensions/*`, `upload/*`, `use-ast-editor.ts`, `drift-warn.ts`, `index.ts` (public API не расширяем), `schema-cache.ts`, `serializer.ts`, `deserializer.ts`.
- `src/components/ast-render/marks/{link,document-ref,glossary-ref,lecture-ref}.tsx`, `block-renderer.tsx`, `ast-render.tsx`, `index.ts`.
- **Frozen zones (CLAUDE.md):** `src/api/schema.ts`, `src/app/layout.tsx`, `src/app/admin/*`, `src/app/globals.css`, `src/components/ui/*`, `src/components/{shared,app,permission}`, `src/utils/*`, `src/hooks/*`, `src/services/*`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.ts`.

**Правила параллельной работы (CLAUDE.md, передавать дословно всем субагентам):** запрещены `git stash`, `git reset`, `git checkout .`, `git clean` и любые откаты/перезапись чужих изменений; `git add` — только свои файлы по имени (никогда `-A` / `.`); эти правила передаются всем создаваемым субагентам.

---

## Контракты, на которые опирается план (проверены по коду main)

| Что | Где | Сигнатура / факт |
| --- | --- | --- |
| upload action | `src/components/ast-editor/upload/upload-image.ts` | `uploadImage(formData: FormData): Promise<UploadImageResult>`; success → `{ success: true, data: { storage_key, upload_id } }`; failure → `{ success: false, error, code? }` |
| URL helper | `src/components/ast-editor/upload/storage-url.ts` | `resolveStorageUrl(storageKey: string): string` → `${NEXT_PUBLIC_STORAGE_URL ?? NEXT_PUBLIC_API_URL ?? ""}/static/files/<key>`; `""` → `""` |
| image-блок в редакторе | `extensions/nodes/image.ts` | attrs: `storage_key`, `alt`, `caption`, `blockId` |
| RefMenu | `pickers/ref-menu.tsx` | `{ editor, defaultLectureId?, onClose? }`; `apply` вставляет label-текст с mark при пустом выделении |
| Пикеры | `pickers/*-picker.tsx` | все: `onSelect: (id: string, label: string) => void` |
| Toast | `@/components/ui` | `useToast()` → Base UI manager `{ add({ title, description }), … }`; `ToastProvider`+`Toaster` уже в root layout |
| slash-menu паттерн | `toolbar/slash-menu-plugin.ts` | PluginKey-state `{ open, from, query }`, `handleTextInput` + meta, `consumeSlashMarker` |
| ast-render типы | `src/components/ast-render/types.ts` | `AstMarkType` уже включает `media_ref`/`comment_ref`/`canvas_ref` |
| Иконка | `@/assets/icons/image-icon` | `export const ImageIcon = (props: SVGProps<SVGSVGElement>) => …` |

Команды тестов: точечно `npx vitest run <путь>`, весь suite `npm test` (script = `vitest run`).

---

## Task 1: Верификация предусловий (без коммита)

**Files:** только чтение.

- [ ] **Step 1: Проверить, что 2a/2b/2c смержены и RefPopover уже подключён**

Run:

```bash
ls src/components/ast-editor/upload/upload-image.ts src/components/ast-editor/pickers/ref-menu.tsx src/components/ast-editor/toolbar/buttons/ref-popover.tsx
grep -n "RefPopover" src/components/ast-editor/toolbar/toolbar.tsx
```

Expected: все три файла существуют; `toolbar.tsx` импортирует и рендерит `RefPopover`. Если RefPopover отсутствует — состояние ветки отличается от main `c7e0da3e`: остановиться и доложить менеджеру (план писался против этого состояния).

- [ ] **Step 2: Проверить, что canvas сейчас подключён в RefMenu**

Run: `grep -n "CanvasPicker\|canvas" src/components/ast-editor/pickers/ref-menu.tsx`
Expected: импорт `CanvasPicker`, ключ `canvas` в `MARK_FOR`/`labels` и render-ветка. Если canvas уже отключён — в Task 5 выполнить только шаги с тестами.

- [ ] **Step 3: Проверить баг ast-render image**

Run: `grep -n "attrs?.src" src/components/ast-render/nodes/image.tsx`
Expected: совпадение есть (рендер читает `src`, которого бек не присылает).

---

## Task 2: ImageButton — failing test

**Files:**
- Create: `src/components/ast-editor/toolbar/buttons/image-button.test.tsx`

- [ ] **Step 1: Написать тест**

```tsx
// src/components/ast-editor/toolbar/buttons/image-button.test.tsx
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// vi.mock поднимается выше всех объявлений файла — внешние переменные внутри
// фабрики допустимы только через vi.hoisted, иначе ReferenceError.
const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }));
vi.mock("@/components/ui", () => ({
  useToast: () => ({ add: toastAdd }),
}));
vi.mock("../../upload/upload-image", () => ({
  uploadImage: vi.fn(),
}));

import { Editor } from "@tiptap/core";
import { ImageButton } from "./image-button";
import { uploadImage } from "../../upload/upload-image";
import { buildExtensions } from "../../extensions";
import { makePngFile } from "../../upload/__fixtures__/png-1x1";
import type { SchemaSnapshot } from "../../types";

const mockedUpload = uploadImage as unknown as ReturnType<typeof vi.fn>;

// 64-hex — как настоящий sha256 storage_key с бека.
const KEY = "a1b2c3d4".repeat(8);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const snapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "image"], basic: ["paragraph"] },
  entityBlockLimits: { full: 100, basic: 100 },
  entityContexts: { document: "full", comment: "basic" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

function makeEditor() {
  return new Editor({
    extensions: buildExtensions({ snapshot, context: "document" }),
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

describe("ImageButton", () => {
  it("загружает выбранный файл и вставляет image-блок со storage_key", async () => {
    mockedUpload.mockResolvedValue({
      success: true,
      data: { storage_key: KEY, upload_id: "u-1" },
    });
    const editor = makeEditor();
    const { container } = render(
      <ImageButton editor={editor} schema={snapshot} context="document" />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [makePngFile()] } });

    await waitFor(() => {
      expect(JSON.stringify(editor.getJSON())).toContain(KEY);
    });
    expect(mockedUpload).toHaveBeenCalledOnce();
    expect(toastAdd).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("ошибка загрузки → toast, блок не вставляется", async () => {
    mockedUpload.mockResolvedValue({
      success: false,
      error: "Изображение слишком большое (макс 10 MiB)",
      code: "image_too_large",
    });
    const editor = makeEditor();
    const { container } = render(
      <ImageButton editor={editor} schema={snapshot} context="document" />,
    );

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [makePngFile()] },
    });

    await waitFor(() => expect(toastAdd).toHaveBeenCalledOnce());
    expect(JSON.stringify(editor.getJSON())).not.toContain('"type":"image"');
    editor.destroy();
  });

  it("код forbidden → branded-текст в toast", async () => {
    mockedUpload.mockResolvedValue({
      success: false,
      error: "raw backend error",
      code: "forbidden",
    });
    const editor = makeEditor();
    const { container } = render(
      <ImageButton editor={editor} schema={snapshot} context="document" />,
    );

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [makePngFile()] },
    });

    await waitFor(() => expect(toastAdd).toHaveBeenCalledOnce());
    const arg = toastAdd.mock.calls[0]![0] as { description?: string };
    expect(arg.description).toMatch(/нет прав/i);
    editor.destroy();
  });

  it("не рендерится, если image не разрешён в контексте (comment/basic)", () => {
    const editor = makeEditor();
    render(<ImageButton editor={editor} schema={snapshot} context="comment" />);
    expect(screen.queryByLabelText(/изображение/i)).toBeNull();
    editor.destroy();
  });
});
```

- [ ] **Step 2: Запустить — должен провалиться (компонента нет)**

Run: `npx vitest run src/components/ast-editor/toolbar/buttons/image-button.test.tsx`
Expected: FAIL — `Cannot find module './image-button'`.

---

## Task 3: ImageButton — реализация

**Files:**
- Create: `src/components/ast-editor/toolbar/buttons/image-button.tsx`

**Why server action + toast:** auth — httpOnly cookie, клиентский fetch невозможен → переиспользуем `uploadImage` (2a). Toast закрывает отложенный из 2a пункт «UI-toast при upload-ошибке» для toolbar-потока. Branded-текст при `forbidden` — конвенция RBAC (CLAUDE.md). Toast в paste/drop-плагине НЕ трогаем (см. «Что НЕ входит»).

- [ ] **Step 1: Реализовать компонент**

```tsx
// src/components/ast-editor/toolbar/buttons/image-button.tsx
"use client";
import { useRef, useState, type ChangeEvent } from "react";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { ImageIcon } from "@/assets/icons/image-icon";
import { useToast } from "@/components/ui";
import { uploadImage } from "../../upload/upload-image";
import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

/**
 * Toolbar-кнопка вставки изображения: скрытый file-input → uploadImage
 * (server action из Phase 2a) → insertContent image-блока. Ошибки — toast
 * (провайдер смонтирован в root layout). Гейтится per-context, как остальные
 * block-кнопки (самогейт + дублирующий гейт в toolbar.tsx для сепараторов).
 */
export function ImageButton({ editor, schema, context }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("image")) return null;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбрасываем value, чтобы повторный выбор того же файла снова дал change.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadImage(fd);
      if (!res.success) {
        toast.add({
          title: "Не удалось загрузить изображение",
          description:
            res.code === "forbidden"
              ? "У вас нет прав на загрузку изображений."
              : res.error,
        });
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            storage_key: res.data.storage_key,
            alt: "",
            caption: "",
            blockId: "",
          },
        })
        .run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Toolbar.Button
        aria-label="Изображение"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <ImageIcon />
      </Toolbar.Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e);
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Прогнать тест — PASS**

Run: `npx vitest run src/components/ast-editor/toolbar/buttons/image-button.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/toolbar/buttons/image-button.tsx src/components/ast-editor/toolbar/buttons/image-button.test.tsx
git commit -m "feat(ast-editor): add image upload toolbar button with toast errors"
```

---

## Task 4: Wiring — ImageButton в toolbar + defaultLectureId до RefMenu

**Files:**
- Modify: `src/components/ast-editor/toolbar/toolbar.tsx`
- Modify: `src/components/ast-editor/toolbar/buttons/ref-popover.tsx`
- Modify: `src/components/ast-editor/ast-editor.tsx` (одна строка — пропс EditorToolbar)
- Modify: `src/components/ast-editor/toolbar/toolbar.test.tsx`

**Why defaultLectureId:** `AstEditorProps.defaultLectureId` объявлен ещё в Phase 2c, но никуда не прокинут (dead prop), при этом `RefMenu` и `Comment2StagePicker` его поддерживают. Закрываем разрыв: страница лекции сможет передать контекст, и comment-picker стартует сразу с шага 2.

- [ ] **Step 1: Обновить toolbar.test.tsx (failing для новых кейсов)**

Полная замена файла:

```tsx
// src/components/ast-editor/toolbar/toolbar.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Фабрики vi.mock не должны ссылаться на внешние переменные (hoisting).
// toolbar.test не ассертит вызовы toast — достаточно inline vi.fn().
vi.mock("@/components/ui", () => ({
  useToast: () => ({ add: vi.fn() }),
}));
vi.mock("../pickers/actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { Editor } from "@tiptap/core";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as pickerActions from "../pickers/actions";
import { EditorToolbar } from "./toolbar";
import { buildExtensions } from "../extensions";
import type { EntityContext, SchemaSnapshot } from "../types";

const mockedActions = pickerActions as unknown as {
  searchCommentsByLecture: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const fullSchema: SchemaSnapshot = {
  blockLevels: {
    full: ["paragraph", "heading", "blockquote", "code_block", "list", "image", "table", "thematic_break"],
    basic: ["paragraph"],
  },
  entityBlockLimits: { full: 20000, basic: 100 },
  entityContexts: { document: "full", comment: "basic" },
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map([["bold", { attrs: {} }], ["italic", { attrs: {} }], ["code", { attrs: {} }], ["link", { attrs: {} }]]),
  exclusiveCategories: [],
};

const makeEditor = (context: EntityContext) =>
  new Editor({ extensions: buildExtensions({ snapshot: fullSchema, context }) });

describe("EditorToolbar gating", () => {
  it("document context: shows heading select, blockquote, code-block, list, table, hr, image", () => {
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="document" />);
    expect(screen.getByLabelText(/тип блока/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/цитата/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/блок кода/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/маркированный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/нумерованный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/таблица/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/горизонтальная линия/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/изображение/i)).toBeInTheDocument();
    editor.destroy();
  });

  it("shows RefPopover when nav-ref marks are registered", () => {
    const navSchema: SchemaSnapshot = {
      ...fullSchema,
      marks: new Map([
        ["bold", { attrs: {} }],
        ["link", { attrs: {} }],
        ["lecture_ref", { attrs: {} }],
      ]),
    };
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={navSchema} context="document" />);
    expect(screen.getByLabelText(/вставить ссылку на сущность/i)).toBeInTheDocument();
    editor.destroy();
  });

  it("hides RefPopover when nav-ref marks are not registered", () => {
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="document" />);
    expect(screen.queryByLabelText(/вставить ссылку на сущность/i)).toBeNull();
    editor.destroy();
  });

  it("comment context (basic): hides everything except inline marks + link", () => {
    const editor = makeEditor("comment");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="comment" />);
    expect(screen.queryByLabelText(/тип блока/i)).toBeNull();
    expect(screen.queryByLabelText(/цитата/i)).toBeNull();
    expect(screen.queryByLabelText(/блок кода/i)).toBeNull();
    expect(screen.queryByLabelText(/маркированный список/i)).toBeNull();
    expect(screen.queryByLabelText(/таблица/i)).toBeNull();
    expect(screen.queryByLabelText(/изображение/i)).toBeNull();
    // inline marks + link still present (always-allowed)
    expect(screen.getByLabelText(/жирный/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ссылка/i)).toBeInTheDocument();
    editor.destroy();
  });
});

describe("EditorToolbar defaultLectureId", () => {
  it("прокидывает defaultLectureId до Comment2StagePicker (сразу шаг 2)", async () => {
    mockedActions.searchCommentsByLecture.mockResolvedValue({ data: [], total: 0 });
    const navSchema: SchemaSnapshot = {
      ...fullSchema,
      marks: new Map([["lecture_ref", { attrs: {} }]]),
    };
    const editor = makeEditor("document");
    render(
      <EditorToolbar
        editor={editor}
        schema={navSchema}
        context="document"
        defaultLectureId="L42"
      />,
    );
    fireEvent.click(screen.getByLabelText(/вставить ссылку на сущность/i));
    fireEvent.click(await screen.findByRole("button", { name: "Комментарий" }));
    expect(await screen.findByText(/шаг 2/i)).toBeInTheDocument();
    editor.destroy();
  });
});
```

Примечание: если Base UI Popover в jsdom не откроется по `fireEvent.click` (попап не появился, `findByRole` таймаутится) — заменить открытие на `fireEvent.pointerDown` + `fireEvent.click` по триггеру; это поведение Base UI, сверить по факту.

- [ ] **Step 2: Прогнать — новые кейсы падают**

Run: `npx vitest run src/components/ast-editor/toolbar/toolbar.test.tsx`
Expected: FAIL — нет `aria-label="Изображение"` в document-кейсе, у `EditorToolbar` нет пропа `defaultLectureId`.

- [ ] **Step 3: toolbar.tsx — полная замена**

```tsx
// src/components/ast-editor/toolbar/toolbar.tsx
"use client";
import { Fragment } from "react";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { InlineMarksGroup } from "./buttons/inline-marks";
import { HeadingSelect } from "./buttons/heading-select";
import { BlockButtonsGroup } from "./buttons/block-buttons";
import { ListButtonsGroup } from "./buttons/list-buttons";
import { LinkPopover } from "./buttons/link-popover";
import { RefPopover } from "./buttons/ref-popover";
import { ImageButton } from "./buttons/image-button";
import type { SchemaSnapshot, EntityContext } from "../types";

export interface EditorToolbarProps {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
  /** Контекст лекции для comment_ref picker'а (2-stage стартует сразу с шага 2). */
  defaultLectureId?: string | undefined;
}

export function EditorToolbar({ editor, schema, context, defaultLectureId }: EditorToolbarProps) {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);

  // Visibility mirrors each group's internal gate. Duplicated intentionally
  // so toolbar can interleave separators only between non-empty groups.
  const groups = [
    {
      visible:
        schema.marks.has("bold") || schema.marks.has("italic") || schema.marks.has("code"),
      node: <InlineMarksGroup editor={editor} schema={schema} />,
    },
    {
      visible: allowed.has("heading"),
      node: <HeadingSelect editor={editor} schema={schema} context={context} />,
    },
    {
      visible:
        allowed.has("blockquote") ||
        allowed.has("code_block") ||
        allowed.has("thematic_break") ||
        allowed.has("table"),
      node: <BlockButtonsGroup editor={editor} schema={schema} context={context} />,
    },
    {
      visible: allowed.has("image"),
      node: <ImageButton editor={editor} schema={schema} context={context} />,
    },
    {
      visible: allowed.has("list"),
      node: <ListButtonsGroup editor={editor} schema={schema} context={context} />,
    },
    {
      visible: schema.marks.has("link"),
      node: <LinkPopover editor={editor} schema={schema} />,
    },
    {
      visible: schema.marks.has("lecture_ref"),
      node: <RefPopover editor={editor} schema={schema} defaultLectureId={defaultLectureId} />,
    },
  ].filter((g) => g.visible);

  return (
    <Toolbar.Root>
      {groups.map((g, i) => (
        <Fragment key={i}>
          {i > 0 && <Toolbar.Separator />}
          {g.node}
        </Fragment>
      ))}
    </Toolbar.Root>
  );
}
```

- [ ] **Step 4: ref-popover.tsx — полная замена**

```tsx
// src/components/ast-editor/toolbar/buttons/ref-popover.tsx
"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { BookmarkIcon } from "@/assets/icons/bookmark-icon";
import { RefMenu } from "../../pickers/ref-menu";
import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  defaultLectureId?: string | undefined;
}

export function RefPopover({ editor, schema, defaultLectureId }: Props) {
  const [open, setOpen] = useState(false);

  // Show only if at least one nav-ref mark is registered.
  if (!schema.marks.has("lecture_ref")) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={<Toolbar.Button aria-label="Вставить ссылку на сущность" />}
      >
        <BookmarkIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-3 shadow-lg min-w-[320px] max-w-[480px]">
            <Popover.Arrow className="fill-(--color-background) stroke-(--color-border)" />
            <RefMenu
              editor={editor}
              defaultLectureId={defaultLectureId}
              onClose={() => setOpen(false)}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

- [ ] **Step 5: ast-editor.tsx — прокинуть проп в EditorToolbar**

В `src/components/ast-editor/ast-editor.tsx` заменить строку рендера toolbar:

```tsx
      {props.editable !== false && (
        <EditorToolbar
          editor={editor}
          schema={schema}
          context={props.entityContext}
          defaultLectureId={props.defaultLectureId}
        />
      )}
```

(остальное в файле не трогать — AtMenu добавится в Task 8).

- [ ] **Step 6: Прогнать toolbar-тесты — PASS**

Run: `npx vitest run src/components/ast-editor/toolbar/toolbar.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 7: Прогнать весь suite (регрессии wiring)**

Run: `npm test`
Expected: все тесты PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ast-editor/toolbar/toolbar.tsx src/components/ast-editor/toolbar/toolbar.test.tsx src/components/ast-editor/toolbar/buttons/ref-popover.tsx src/components/ast-editor/ast-editor.tsx
git commit -m "feat(ast-editor): wire image button into toolbar and thread defaultLectureId to RefMenu"
```

---

## Task 5: Canvas dormant — отключить категорию в RefMenu + хук onWillInsert

**Files:**
- Modify: `src/components/ast-editor/pickers/ref-menu.tsx`
- Modify: `src/components/ast-editor/pickers/ref-menu.test.tsx`

**Зафиксированное отклонение от плана 2b:** 2b подключил CanvasPicker в RefMenu; спека программы (волна 1 / §4) требует canvas dormant. Удаляем только категорию из меню. `pickers/canvas-picker.tsx`, его тест в `pickers.test.tsx` и `searchCanvases` в `pickers/actions.ts` НЕ удалять. Mark `canvas_ref` остаётся зарегистрированным в редакторе (`extensions/marks/nav-ref.ts`) и в `drift-warn.ts` — он есть в схеме бека, существующий контент должен round-trip'иться; UI для вставки просто исчезает.

`onWillInsert` добавляем здесь же (один rewrite файла): он нужен Task 7 (AtMenu удаляет `@`-маркер перед вставкой).

- [ ] **Step 1: Дописать failing-тесты в ref-menu.test.tsx**

Добавить в конец `describe("RefMenu", …)` (после второго `it`):

```tsx
  it("не показывает категорию Canvas (canvas вне скоупа — dormant)", () => {
    const editor = makeEditor();
    render(<RefMenu editor={editor} />);
    expect(screen.queryByRole("button", { name: /canvas/i })).toBeNull();
    // Остальные пять категорий на месте.
    for (const name of ["Лекция", "Термин", "Документ", "Медиа", "Комментарий"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    editor.destroy();
  });

  it("onWillInsert вызывается до вставки mark", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    const onWillInsert = vi.fn();
    render(<RefMenu editor={editor} onWillInsert={onWillInsert} />);
    fireEvent.click(screen.getByRole("button", { name: /лекция/i }));
    fireEvent.mouseDown(await screen.findByText("L1"));
    expect(onWillInsert).toHaveBeenCalledOnce();
    expect(JSON.stringify(editor.getJSON())).toContain('"type":"lecture_ref"');
    editor.destroy();
  });
```

- [ ] **Step 2: Прогнать — оба новых кейса падают**

Run: `npx vitest run src/components/ast-editor/pickers/ref-menu.test.tsx`
Expected: FAIL — кнопка Canvas присутствует; пропа `onWillInsert` нет.

- [ ] **Step 3: ref-menu.tsx — полная замена**

```tsx
// src/components/ast-editor/pickers/ref-menu.tsx
"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { LecturePicker } from "./lecture-picker";
import { GlossaryPicker } from "./glossary-picker";
import { DocumentPicker } from "./document-picker";
import { MediaPicker } from "./media-picker";
import { Comment2StagePicker } from "./comment-2stage-picker";

// canvas вне скоупа программы покрытия (спека 2026-06-12 §4): CanvasPicker
// остаётся в репо dormant (pickers/canvas-picker.tsx), в меню не подключён,
// canvas_ref в редакторе зарегистрирован только ради round-trip контента.
type Category = "lecture" | "glossary" | "document" | "media" | "comment";

const MARK_FOR: Record<Category, string> = {
  lecture: "lecture_ref",
  glossary: "glossary_ref",
  document: "document_ref",
  media: "media_ref",
  comment: "comment_ref",
};

const labels: Record<Category, string> = {
  lecture: "Лекция",
  glossary: "Термин",
  document: "Документ",
  media: "Медиа",
  comment: "Комментарий",
};

export interface RefMenuProps {
  editor: Editor;
  defaultLectureId?: string | undefined;
  onClose?: () => void;
  /**
   * Вызывается синхронно ПЕРЕД вставкой mark. @-suggestion (AtMenu) удаляет
   * здесь "@"-маркер из документа; selection после удаления схлопывается в
   * позицию маркера, и вставка label-текста попадает ровно туда.
   */
  onWillInsert?: () => void;
}

export function RefMenu({ editor, defaultLectureId, onClose, onWillInsert }: RefMenuProps) {
  const [cat, setCat] = useState<Category | null>(null);

  const apply = (markName: string, id: string, label: string) => {
    onWillInsert?.();
    const empty = editor.state.selection.empty;
    if (empty) {
      // Collapsed selection — insert the human-readable label as text carrying
      // the mark; otherwise setMark only goes into storedMarks and the user
      // sees no visible nav-ref. Same pattern as LinkPopover (toolbar).
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [{ type: markName, attrs: { id } }],
        })
        .run();
    } else {
      editor.chain().focus().setMark(markName, { id }).run();
    }
    onClose?.();
  };

  const onSelect = (id: string, label: string) => {
    if (cat) apply(MARK_FOR[cat], id, label);
  };

  return (
    <div className="ref-menu" role="dialog" aria-label="Вставить ссылку">
      <div className="ref-menu__cats">
        {(Object.keys(MARK_FOR) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
          >
            {labels[c]}
          </button>
        ))}
      </div>
      <div className="ref-menu__picker">
        {cat === "lecture" && <LecturePicker onSelect={onSelect} />}
        {cat === "glossary" && <GlossaryPicker onSelect={onSelect} />}
        {cat === "document" && <DocumentPicker onSelect={onSelect} />}
        {cat === "media" && <MediaPicker onSelect={onSelect} />}
        {cat === "comment" && (
          <Comment2StagePicker defaultLectureId={defaultLectureId} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
```

Важно: `onWillInsert?.()` — первая строка `apply`, ДО чтения `editor.state.selection.empty` (после удаления маркера selection схлопнут → ветка insertContent).

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run src/components/ast-editor/pickers/ref-menu.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Прогнать pickers-тесты (CanvasPicker как компонент жив)**

Run: `npx vitest run src/components/ast-editor/pickers/pickers.test.tsx`
Expected: PASS — тест CanvasPicker остался зелёным (компонент dormant, но рабочий).

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/pickers/ref-menu.tsx src/components/ast-editor/pickers/ref-menu.test.tsx
git commit -m "feat(ast-editor): disable canvas category in RefMenu (dormant) and add onWillInsert hook"
```

---

## Task 6: @-suggestion — ProseMirror plugin

**Files:**
- Create: `src/components/ast-editor/pickers/at-suggestion-plugin.ts`
- Test: `src/components/ast-editor/pickers/at-suggestion-plugin.test.ts`

**Поведение** (зеркало slash-menu-plugin, отличие — условие срабатывания): `@` открывает меню, если напечатан в начале текста или после пробельного символа (не внутри слова — e-mail не триггерит). Дальнейший ввод дописывает `query`; если текст после маркера перестал начинаться с `@` — состояние закрывается. Esc закрывает. `consumeAtMarker` удаляет `@`+query и закрывает состояние.

- [ ] **Step 1: Failing test**

```ts
// src/components/ast-editor/pickers/at-suggestion-plugin.test.ts
import { describe, it, expect } from "vitest";
import { Editor, Extension } from "@tiptap/core";
import { buildExtensions } from "../extensions";
import {
  createAtSuggestionPlugin,
  atSuggestionKey,
  consumeAtMarker,
} from "./at-suggestion-plugin";
import type { SchemaSnapshot } from "../types";

const snapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const atHost = Extension.create({
  name: "at-suggestion-host",
  addProseMirrorPlugins() {
    return [createAtSuggestionPlugin()];
  },
});

function makeEditor(text?: string) {
  return new Editor({
    extensions: [...buildExtensions({ snapshot, context: "document" }), atHost],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
      ],
    },
  });
}

describe("createAtSuggestionPlugin", () => {
  it("'@' в пустом параграфе открывает state", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.someProp("handleTextInput", (fn) => fn(view, 1, 1, "@"));
    const s = atSuggestionKey.getState(view.state);
    expect(s?.open).toBe(true);
    expect(s?.from).toBe(1);
    editor.destroy();
  });

  it("'@' после пробела открывает state", () => {
    const editor = makeEditor("foo ");
    const view = editor.view;
    // текст "foo " занимает позиции 1..5, курсор в 5
    view.someProp("handleTextInput", (fn) => fn(view, 5, 5, "@"));
    expect(atSuggestionKey.getState(view.state)?.open).toBe(true);
    editor.destroy();
  });

  it("'@' внутри слова (e-mail) НЕ открывает state", () => {
    const editor = makeEditor("user");
    const view = editor.view;
    view.someProp("handleTextInput", (fn) => fn(view, 5, 5, "@"));
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("consumeAtMarker удаляет '@' и закрывает state", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.dispatch(
      view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );
    expect(editor.getText()).toBe("@");
    consumeAtMarker(view, 1);
    expect(editor.getText()).toBe("");
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });

  it("ввод текста после '@' дописывает query, потеря '@' закрывает", () => {
    const editor = makeEditor();
    const view = editor.view;
    view.dispatch(
      view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );
    view.dispatch(view.state.tr.insertText("ab", 2));
    expect(atSuggestionKey.getState(view.state)?.query).toBe("ab");
    // Удаляем весь маркер вместе с query — состояние закрывается.
    view.dispatch(view.state.tr.delete(1, 4));
    expect(atSuggestionKey.getState(view.state)?.open).toBe(false);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Прогнать — fail (модуля нет)**

Run: `npx vitest run src/components/ast-editor/pickers/at-suggestion-plugin.test.ts`
Expected: FAIL — `Cannot find module './at-suggestion-plugin'`.

- [ ] **Step 3: Реализовать plugin**

```ts
// src/components/ast-editor/pickers/at-suggestion-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface AtSuggestionState {
  open: boolean;
  from: number; // позиция "@" — чтобы удалить маркер при вставке
  query: string;
}

export const atSuggestionKey = new PluginKey<AtSuggestionState>(
  "ast-editor-at-suggestion",
);

const CLOSED: AtSuggestionState = { open: false, from: -1, query: "" };

/**
 * "@"-suggestion: печать "@" в начале текста или после пробела открывает
 * AtMenu (RefMenu inline). Зеркало slash-menu-plugin (toolbar/slash-menu-plugin.ts):
 * state {open, from, query}, mapping позиций через tr.mapping, закрытие при
 * потере "@" в начале маркера и по Esc.
 */
export function createAtSuggestionPlugin() {
  return new Plugin<AtSuggestionState>({
    key: atSuggestionKey,
    state: {
      init: () => CLOSED,
      apply(tr, prev) {
        const meta = tr.getMeta(atSuggestionKey) as Partial<AtSuggestionState> | undefined;
        if (meta) return { ...prev, ...meta };
        if (!prev.open) return prev;
        // Map prev.from через mapping любых правок других плагинов, иначе
        // позиция "@" устареет и textBetween вернёт мусор.
        const mappedFrom = tr.mapping.map(prev.from, -1);
        if (tr.docChanged) {
          const end = tr.selection.from;
          if (end < mappedFrom) return CLOSED;
          const text = tr.doc.textBetween(mappedFrom, end);
          if (!text.startsWith("@")) return CLOSED;
          return { ...prev, from: mappedFrom, query: text.slice(1) };
        }
        return { ...prev, from: mappedFrom };
      },
    },
    props: {
      handleTextInput(view, from, _to, text) {
        if (text !== "@") return false;
        const state = atSuggestionKey.getState(view.state);
        if (state?.open) return false;
        const $from = view.state.doc.resolve(from);
        if (!$from.parent.isTextblock) return false;
        // Только в начале текста или после пробельного символа — "@" внутри
        // слова (например, e-mail) меню не открывает.
        const before = $from.parent.textBetween(0, $from.parentOffset, "￼", "￼");
        if (before.length > 0 && !/\s$/.test(before)) return false;
        view.dispatch(
          view.state.tr.setMeta(atSuggestionKey, { open: true, from, query: "" }),
        );
        return false; // "@" вставляется как обычный текст
      },
      handleKeyDown(view, event) {
        const s = atSuggestionKey.getState(view.state);
        if (!s?.open) return false;
        if (event.key === "Escape") {
          view.dispatch(view.state.tr.setMeta(atSuggestionKey, CLOSED));
          return true;
        }
        return false;
      },
    },
  });
}

export function closeAtSuggestion(view: import("@tiptap/pm/view").EditorView) {
  view.dispatch(view.state.tr.setMeta(atSuggestionKey, CLOSED));
}

/** Удаляет "@"+query из документа и закрывает состояние (selection схлопывается в from). */
export function consumeAtMarker(
  view: import("@tiptap/pm/view").EditorView,
  from: number,
) {
  const to = view.state.selection.from;
  view.dispatch(view.state.tr.delete(from, to).setMeta(atSuggestionKey, CLOSED));
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run src/components/ast-editor/pickers/at-suggestion-plugin.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/pickers/at-suggestion-plugin.ts src/components/ast-editor/pickers/at-suggestion-plugin.test.ts
git commit -m "feat(ast-editor): add @-suggestion ProseMirror plugin (state machine, marker consume)"
```

---

## Task 7: AtMenu — React-обёртка RefMenu для @-suggestion

**Files:**
- Create: `src/components/ast-editor/pickers/at-menu.tsx`
- Test: `src/components/ast-editor/pickers/at-menu.test.tsx`

**Поведение:** подписка на транзакции редактора (как SlashMenu); пока state закрыт — `null`; при open рендерит RefMenu. `onWillInsert` → `consumeAtMarker` (удаляет `@`+query), `onClose` → `closeAtSuggestion`. Позиционирование — inline-панель под редактором, как у slash-menu (точное позиционирование под курсор — за скоупом, та же договорённость, что в 2c). Query, набранный после `@`, пикеры не фильтрует (у каждого пикера свой поиск) — он удаляется вместе с маркером.

- [ ] **Step 1: Failing test**

```tsx
// src/components/ast-editor/pickers/at-menu.test.tsx
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { Editor, Extension } from "@tiptap/core";
import * as actions from "./actions";
import { AtMenu } from "./at-menu";
import { createAtSuggestionPlugin, atSuggestionKey } from "./at-suggestion-plugin";
import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

const mocked = actions as unknown as { searchLectures: ReturnType<typeof vi.fn> };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const snapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const atHost = Extension.create({
  name: "at-suggestion-host",
  addProseMirrorPlugins() {
    return [createAtSuggestionPlugin()];
  },
});

function makeEditor() {
  return new Editor({
    extensions: [...buildExtensions({ snapshot, context: "document" }), atHost],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

describe("AtMenu", () => {
  it("скрыт, пока plugin-state закрыт", () => {
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    editor.destroy();
  });

  it("открывается по '@', вставляет lecture_ref и удаляет маркер", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    render(<AtMenu editor={editor} />);

    // Открываем так же, как это делает handleTextInput: "@" в doc + meta.
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("@", 1)
        .setMeta(atSuggestionKey, { open: true, from: 1, query: "" }),
    );

    expect(
      await screen.findByRole("dialog", { name: /вставить ссылку/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Лекция" }));
    fireEvent.mouseDown(await screen.findByText("L1"));

    // "@" удалён, вставлен label с mark.
    expect(editor.getText()).toBe("L1");
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"lecture_ref"');
    expect(json).toContain('"id":"l1"');
    // Состояние закрыто → меню скрыто (через transaction-listener, ждём React).
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    editor.destroy();
  });
});
```

- [ ] **Step 2: Прогнать — fail (компонента нет)**

Run: `npx vitest run src/components/ast-editor/pickers/at-menu.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать AtMenu**

```tsx
// src/components/ast-editor/pickers/at-menu.tsx
"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  atSuggestionKey,
  closeAtSuggestion,
  consumeAtMarker,
  type AtSuggestionState,
} from "./at-suggestion-plugin";
import { RefMenu } from "./ref-menu";

interface Props {
  editor: Editor;
  defaultLectureId?: string | undefined;
}

/**
 * Inline-обёртка RefMenu для @-suggestion. Требует createAtSuggestionPlugin
 * в extensions редактора (atHost в ast-editor.tsx). MVP: панель рендерится
 * под редактором (как slash-menu); позиционирование под курсор — follow-up.
 */
export function AtMenu({ editor, defaultLectureId }: Props) {
  const [state, setState] = useState<AtSuggestionState>({
    open: false,
    from: -1,
    query: "",
  });

  useEffect(() => {
    const upd = () => {
      const s = atSuggestionKey.getState(editor.view.state);
      if (s) setState(s);
    };
    editor.on("transaction", upd);
    return () => {
      editor.off("transaction", upd);
    };
  }, [editor]);

  if (!state.open) return null;

  return (
    <div className="ast-at-menu" data-at-menu="">
      <RefMenu
        editor={editor}
        defaultLectureId={defaultLectureId}
        onWillInsert={() => consumeAtMarker(editor.view, state.from)}
        onClose={() => closeAtSuggestion(editor.view)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run src/components/ast-editor/pickers/at-menu.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/pickers/at-menu.tsx src/components/ast-editor/pickers/at-menu.test.tsx
git commit -m "feat(ast-editor): add AtMenu — @-suggestion opens RefMenu and consumes marker"
```

---

## Task 8: Wiring AtMenu в AstEditor

**Files:**
- Modify: `src/components/ast-editor/ast-editor.tsx`

- [ ] **Step 1: Подключить atHost и AtMenu**

В `src/components/ast-editor/ast-editor.tsx`:

1. Дополнить импорты (рядом с импортами SlashMenu):

```tsx
import { AtMenu } from "./pickers/at-menu";
import { createAtSuggestionPlugin } from "./pickers/at-suggestion-plugin";
```

2. Рядом с module-scope `slashHost` добавить (стабильная ссылка между рендерами — то же обоснование, что у slashHost):

```tsx
const atHost = Extension.create({
  name: "at-suggestion-host",
  addProseMirrorPlugins() {
    return [createAtSuggestionPlugin()];
  },
});
```

3. В вызове `useAstEditor` заменить строку `extraExtensions: [slashHost],` на:

```tsx
    extraExtensions: [slashHost, atHost],
```

4. В JSX после блока `<SlashMenu …/>` добавить:

```tsx
      {props.editable !== false && (
        <AtMenu editor={editor} defaultLectureId={props.defaultLectureId} />
      )}
```

- [ ] **Step 2: Прогнать весь suite + build**

Run: `npm test && npm run build`
Expected: тесты PASS, build clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/ast-editor.tsx
git commit -m "feat(ast-editor): wire @-suggestion (atHost plugin + AtMenu) into AstEditor"
```

---

## Task 9: ast-render — image по storage_key через общий resolveStorageUrl

**Files:**
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`
- Modify: `src/components/ast-render/nodes/image.tsx`
- Regenerate: `src/components/ast-render/__snapshots__/ast-render.test.tsx.snap`

**Why:** текущий рендер читает `attrs.src`, которого у image-блока на беке нет (бек: `storage_key` 64-hex + `alt` + `caption`, `internal/ast/schema.go:162-169`) — публичный рендер картинок, созданных редактором, сейчас всегда падает в fallback. Переиспользуем `resolveStorageUrl` из `@/components/ast-editor/upload/storage-url` (единственный источник правды для `/static/files/<key>`; импорт между shared-компонентами разрешён — ESLint-гарды ограничивают только `src/features/*`; модуль pure, без "use client" и без tiptap-зависимостей). Вместо `isSafeHref` валидируем сам ключ строгим `^[0-9a-f]{64}$` — XSS через невалидный ключ невозможен.

- [ ] **Step 1: Обновить фикстуры**

В `src/components/ast-render/__fixtures__/blocks.ts` заменить три image-экспорта (`IMAGE_BLOCK`, `IMAGE_BLOCK_NO_SRC`, `IMAGE_BLOCK_DANGEROUS_SRC`) на:

```ts
/** Валидный 64-hex storage_key — как настоящий sha256 с бека. */
export const STORAGE_KEY_FIXTURE = "deadbeef".repeat(8);

export const IMAGE_BLOCK: AstBlock = {
  id: "img1",
  type: "image",
  attrs: { storage_key: STORAGE_KEY_FIXTURE, alt: "Описание" },
  content: [],
};

export const IMAGE_BLOCK_WITH_CAPTION: AstBlock = {
  id: "img-cap",
  type: "image",
  attrs: { storage_key: STORAGE_KEY_FIXTURE, alt: "Описание", caption: "Подпись" },
  content: [],
};

export const IMAGE_BLOCK_NO_KEY: AstBlock = {
  id: "img2",
  type: "image",
  attrs: { alt: "Без storage_key" },
  content: [],
};

export const IMAGE_BLOCK_INVALID_KEY: AstBlock = {
  id: "img-bad",
  type: "image",
  attrs: { storage_key: "javascript:alert(1)", alt: "bad" },
  content: [],
};
```

(`IMAGE_BLOCK_DANGEROUS_SRC` и `IMAGE_BLOCK_NO_SRC` больше не существуют — их использовал только image-describe в `ast-render.test.tsx`, обновляется в Step 2.)

- [ ] **Step 2: Обновить тесты image (failing)**

В `src/components/ast-render/ast-render.test.tsx`:

1. В блоке импорта фикстур заменить `IMAGE_BLOCK_NO_SRC` → `IMAGE_BLOCK_NO_KEY`, `IMAGE_BLOCK_DANGEROUS_SRC` → `IMAGE_BLOCK_INVALID_KEY`, добавить `IMAGE_BLOCK_WITH_CAPTION` и `STORAGE_KEY_FIXTURE`.

2. Заменить весь `describe("AstRender — image node", …)` на:

```tsx
describe("AstRender — image node", () => {
  it("рендерит <figure><img> с URL из resolveStorageUrl и alt", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK]} />);
    const img = container.querySelector("figure img");
    expect(img?.getAttribute("src")).toContain(`/static/files/${STORAGE_KEY_FIXTURE}`);
    expect(img?.getAttribute("alt")).toBe("Описание");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("рендерит figcaption при наличии caption", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_WITH_CAPTION]} />);
    expect(container.querySelector("figure figcaption")?.textContent).toBe("Подпись");
  });

  it("без storage_key рендерит data-unsupported (без <img>)", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_NO_KEY]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-unsupported='image']")).not.toBeNull();
  });

  it("невалидный storage_key (не 64-hex) отклоняется как unsupported", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_INVALID_KEY]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-unsupported='image']")).not.toBeNull();
  });
});
```

- [ ] **Step 3: Прогнать — image-кейсы падают**

Run: `npx vitest run src/components/ast-render/ast-render.test.tsx`
Expected: FAIL — рендер всё ещё читает `src`.

- [ ] **Step 4: Переписать nodes/image.tsx**

```tsx
// src/components/ast-render/nodes/image.tsx
import type { ReactNode } from "react";
import { resolveStorageUrl } from "@/components/ast-editor/upload/storage-url";

interface Props {
  attrs: Record<string, unknown> | undefined;
}

// Бек (internal/ast/schema.go NodeImage): storage_key — ровно 64 hex-символа
// (sha256 content-address). Строгая проверка ключа исключает инъекцию в URL —
// isSafeHref здесь не нужен.
const STORAGE_KEY_RE = /^[0-9a-f]{64}$/i;

export function ImageNode({ attrs }: Props): ReactNode {
  const storageKey = attrs?.storage_key;
  const alt = attrs?.alt;
  const caption = attrs?.caption;
  if (typeof storageKey !== "string" || !STORAGE_KEY_RE.test(storageKey)) {
    return <div data-unsupported="image" data-reason="missing-or-invalid-storage-key" />;
  }
  return (
    <figure>
      {/* AstRender — server-only, intentionally uses native <img> to avoid client-side next/image runtime; see docs/superpowers/specs/2026-05-02-glossary-feature-design.md §4.1 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveStorageUrl(storageKey)}
        alt={typeof alt === "string" ? alt : ""}
        loading="lazy"
      />
      {typeof caption === "string" && caption.length > 0 ? (
        <figcaption>{caption}</figcaption>
      ) : null}
    </figure>
  );
}
```

- [ ] **Step 5: Прогнать — image-кейсы PASS, combo snapshot падает (ожидаемо)**

Run: `npx vitest run src/components/ast-render/ast-render.test.tsx`
Expected: image-тесты PASS; snapshot-тест FAIL (IMAGE_BLOCK теперь рендерится как figure с новым src).

- [ ] **Step 6: Регенерировать snapshot и проверить дифф глазами**

Run:

```bash
npx vitest run src/components/ast-render/ast-render.test.tsx -u
git diff src/components/ast-render/__snapshots__/ast-render.test.tsx.snap
```

Expected: в снапшоте image-фрагмент сменился на `<figure><img src=".../static/files/deadbeef…" …/></figure>`; других смысловых изменений нет.

- [ ] **Step 7: Прогнать ещё раз без -u — всё PASS**

Run: `npx vitest run src/components/ast-render/ast-render.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ast-render/nodes/image.tsx src/components/ast-render/__fixtures__/blocks.ts src/components/ast-render/ast-render.test.tsx src/components/ast-render/__snapshots__/ast-render.test.tsx.snap
git commit -m "feat(ast-render): render image blocks by storage_key via shared resolveStorageUrl"
```

---

## Task 10: ast-render — марки media_ref и comment_ref

**Files:**
- Create: `src/components/ast-render/marks/media-ref.tsx`
- Create: `src/components/ast-render/marks/comment-ref.tsx`
- Modify: `src/components/ast-render/types.ts`
- Modify: `src/components/ast-render/inline-renderer.tsx`
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`

**Why:** редактор (RefMenu) вставляет `media_ref`/`comment_ref`, а публичный рендер сейчас роняет их в `data-unsupported-mark`. По образцу `document-ref`: дефолт — `<a href>`, переопределение через `ctx`. `canvas_ref` НЕ добавляем (вне скоупа, graceful fallback остаётся и покрывается тестом). Дефолтные href: `/media/{id}` (страница появится в волне 2, слайс `media`) и `/comments/{id}` (резолв якоря определит волна 2, слайс `comments`); страницы-консьюмеры могут переопределить рендер через `ctx.renderMediaRef`/`ctx.renderCommentRef` — тот же подход, что был принят для `document_ref` до существования страницы документов.

- [ ] **Step 1: Добавить фикстуры**

В конец `src/components/ast-render/__fixtures__/blocks.ts`:

```ts
export const PARAGRAPH_WITH_MEDIA_REF: AstBlock = {
  id: "p-mref",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "запись",
      marks: [{ type: "media_ref", attrs: { id: "med-uuid-789" } }],
    },
  ],
};

export const PARAGRAPH_WITH_COMMENT_REF: AstBlock = {
  id: "p-cref",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "реплика",
      marks: [{ type: "comment_ref", attrs: { id: "com-uuid-012" } }],
    },
  ],
};
```

- [ ] **Step 2: Failing-тесты**

В `src/components/ast-render/ast-render.test.tsx`:

1. Добавить в импорт фикстур `PARAGRAPH_WITH_MEDIA_REF, PARAGRAPH_WITH_COMMENT_REF`.

2. В `describe("AstRender — ref-marks", …)` добавить:

```tsx
  it("default: media_ref → <a href='/media/{id}'>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_MEDIA_REF]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/media/med-uuid-789");
    expect(a?.textContent).toBe("запись");
  });

  it("default: comment_ref → <a href='/comments/{id}'>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_COMMENT_REF]} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/comments/com-uuid-012",
    );
  });

  it("ctx.renderMediaRef переопределяет рендер", () => {
    const { container } = render(
      <AstRender
        blocks={[PARAGRAPH_WITH_MEDIA_REF]}
        ctx={{
          renderMediaRef: ({ id, label }) => (
            <span data-custom-media-ref={id}>{label}</span>
          ),
        }}
      />
    );
    expect(container.querySelector("a")).toBeNull();
    expect(
      container.querySelector("[data-custom-media-ref='med-uuid-789']")?.textContent
    ).toBe("запись");
  });
```

3. Заменить весь `describe("AstRender — unsupported marks fallback", …)` (он использует `media_ref` как «неизвестный» mark — после этого таска mark поддержан) на:

```tsx
describe("AstRender — unsupported marks fallback", () => {
  it("canvas_ref (вне скоупа) рендерится как plain text с data-unsupported-mark", () => {
    const block: import("./types").AstBlock = {
      id: "p-unk",
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "canvas-ref",
          marks: [{ type: "canvas_ref", attrs: { id: "x" } }],
        },
      ],
    };
    const { container } = render(<AstRender blocks={[block]} />);
    expect(container.querySelector("[data-unsupported-mark='canvas_ref']")).not.toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("canvas-ref");
  });
});
```

- [ ] **Step 3: Прогнать — новые кейсы падают**

Run: `npx vitest run src/components/ast-render/ast-render.test.tsx`
Expected: FAIL — `media_ref`/`comment_ref` уходят в fallback, `renderMediaRef` не существует в типе ctx.

- [ ] **Step 4: Новые mark-рендереры**

```tsx
// src/components/ast-render/marks/media-ref.tsx
import type { ReactNode } from "react";

export function defaultMediaRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/media/${id}`}>{label}</a>;
}
```

```tsx
// src/components/ast-render/marks/comment-ref.tsx
import type { ReactNode } from "react";

// Отдельной страницы комментария пока нет (волна 2, слайс comments определит
// резолв якоря на странице лекции). Дефолт — канонический путь по id;
// страницы-консьюмеры переопределяют через ctx.renderCommentRef.
export function defaultCommentRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/comments/${id}`}>{label}</a>;
}
```

- [ ] **Step 5: types.ts — полная замена**

```ts
// src/components/ast-render/types.ts
import type { components } from "@/api/schema";
import type { ReactNode } from "react";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type AstNodeType = components["schemas"]["ast.NodeType"];
export type AstMarkType = components["schemas"]["ast.MarkType"];

export interface AstRenderProps {
  blocks: AstBlock[];
  ctx?: AstRenderContext;
}

export interface AstRenderContext {
  /** Override how `glossary_ref` mark is rendered. Default: <a href="/glossary/{id}">{label}</a>. */
  renderGlossaryRef?: RefLinkRenderer;
  /** Override how `lecture_ref` mark is rendered. Default: <a href="/lectures/{id}">{label}</a>. */
  renderLectureRef?: RefLinkRenderer;
  /** Override how `document_ref` mark is rendered. Default: <a href="/documents/{id}">{label}</a>. */
  renderDocumentRef?: RefLinkRenderer;
  /** Override how `media_ref` mark is rendered. Default: <a href="/media/{id}">{label}</a>. */
  renderMediaRef?: RefLinkRenderer;
  /** Override how `comment_ref` mark is rendered. Default: <a href="/comments/{id}">{label}</a>. */
  renderCommentRef?: RefLinkRenderer;
}

export type RefLinkRenderer = (props: { id: string; label: string }) => ReactNode;
```

- [ ] **Step 6: inline-renderer.tsx — полная замена**

```tsx
// src/components/ast-render/inline-renderer.tsx
import type { ReactNode } from "react";
import type {
  AstMark,
  AstNode,
  AstRenderContext,
  RefLinkRenderer,
} from "./types";
import { LinkMark } from "./marks/link";
import { defaultGlossaryRef } from "./marks/glossary-ref";
import { defaultLectureRef } from "./marks/lecture-ref";
import { defaultDocumentRef } from "./marks/document-ref";
import { defaultMediaRef } from "./marks/media-ref";
import { defaultCommentRef } from "./marks/comment-ref";

interface Props {
  nodes: AstNode[] | undefined;
  ctx: AstRenderContext;
}

export function InlineRenderer({ nodes, ctx }: Props): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hard_break") return <br key={i} />;
    if (node.type === "text") {
      return <TextWithMarks key={i} text={node.text ?? ""} marks={node.marks} ctx={ctx} />;
    }
    return <span key={i} data-unsupported={node.type ?? "unknown"}>{node.text ?? ""}</span>;
  });
}

interface TextWithMarksProps {
  text: string;
  marks: AstMark[] | undefined;
  ctx: AstRenderContext;
}

function TextWithMarks({ text, marks, ctx }: TextWithMarksProps): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((children, mark) => applyMark(mark, children, ctx), text);
}

function applyMark(mark: AstMark, children: ReactNode, ctx: AstRenderContext): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "code":
      return <code>{children}</code>;
    case "link": {
      const href = (mark.attrs as { href?: unknown } | undefined)?.href;
      return <LinkMark href={typeof href === "string" ? href : undefined}>{children}</LinkMark>;
    }
    case "glossary_ref":
      return renderRefMark(mark, children, ctx.renderGlossaryRef ?? defaultGlossaryRef);
    case "lecture_ref":
      return renderRefMark(mark, children, ctx.renderLectureRef ?? defaultLectureRef);
    case "document_ref":
      return renderRefMark(mark, children, ctx.renderDocumentRef ?? defaultDocumentRef);
    case "media_ref":
      return renderRefMark(mark, children, ctx.renderMediaRef ?? defaultMediaRef);
    case "comment_ref":
      return renderRefMark(mark, children, ctx.renderCommentRef ?? defaultCommentRef);
    default: {
      // canvas_ref (вне скоупа программы) и будущие mark'и — graceful fallback.
      // @ts-expect-error — drift-detector: при добавлении нового mark.type в схему,
      // TS-компилятор подсветит эту строку (нет ts-error → switch неполный).
      const _exhaustive: never = mark.type;
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        console.warn(`AstRender: unsupported mark type "${_exhaustive ?? "unknown"}"`);
      }
      return <span data-unsupported-mark={mark.type ?? "unknown"}>{children}</span>;
    }
  }
}

function renderRefMark(
  mark: AstMark,
  children: ReactNode,
  renderer: RefLinkRenderer
): ReactNode {
  const id = (mark.attrs as { id?: unknown } | undefined)?.id;
  if (typeof id !== "string" || id.length === 0) return <>{children}</>;
  const label = nodeToString(children);
  return renderer({ id, label });
}

function nodeToString(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToString).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeToString((node as { props: { children: ReactNode } }).props.children);
  }
  return "";
}
```

Важно: `@ts-expect-error` в default-ветке НЕ удалять — `canvas_ref` (и `undefined`) остаются необработанными, ошибка типа сохраняется, drift-детектор работает. Если после правок tsc ругается «unused @ts-expect-error» — значит switch случайно стал исчерпывающим, проверь кейсы.

- [ ] **Step 7: Прогнать — все ast-render тесты PASS**

Run: `npx vitest run src/components/ast-render/ast-render.test.tsx`
Expected: PASS (combo snapshot не изменился — media/comment-фикстуры в него не входят).

- [ ] **Step 8: Commit**

```bash
git add src/components/ast-render/marks/media-ref.tsx src/components/ast-render/marks/comment-ref.tsx src/components/ast-render/types.ts src/components/ast-render/inline-renderer.tsx src/components/ast-render/__fixtures__/blocks.ts src/components/ast-render/ast-render.test.tsx
git commit -m "feat(ast-render): render media_ref and comment_ref marks with ctx override"
```

---

## Task 11: README слайса — актуализация

**Files:**
- Modify: `src/components/ast-editor/README.md`

- [ ] **Step 1: Обновить секцию «Архитектура»**

Заменить строки:

```md
- **Image upload** (Phase 2a, в разработке): `upload/upload-image.ts` server action + paste/drop plugin.
- **Pickers** (Phase 2b, в разработке): AsyncCombobox + 6 категорий + 2-stage comment picker.
- **Toolbar + slash-menu** (Phase 2c): per-context кнопки и `/`-палитра.
- **Drift-warn** (Phase 2c): dev-only sanity-check hardcode ⊆ runtime.
```

на:

```md
- **Image upload** (Phase 2a): `upload/upload-image.ts` server action + paste/drop plugin.
- **Pickers** (Phase 2b): AsyncCombobox + 5 активных категорий + 2-stage comment picker. `canvas-picker.tsx` — dormant (canvas вне скоупа программы), в RefMenu не подключён.
- **Toolbar + slash-menu** (Phase 2c): per-context кнопки и `/`-палитра.
- **Drift-warn** (Phase 2c): dev-only sanity-check hardcode ⊆ runtime.
- **Integration** (Phase 2d): image-кнопка в toolbar (`toolbar/buttons/image-button.tsx`), RefMenu-кнопка (`toolbar/buttons/ref-popover.tsx`), `@`-suggestion (`pickers/at-suggestion-plugin.ts` + `pickers/at-menu.tsx`), прокид `defaultLectureId` до comment-picker'а.
```

- [ ] **Step 2: Обновить секцию «Что НЕ покрыто (Phase 3+)»**

Заменить строку:

```md
- Image toolbar-кнопка / RefMenu trigger в toolbar / `@`-suggestion — добавляются tail-PR'ами после merge 2a + 2b.
```

на:

```md
- Canvas: picker dormant, `canvas_ref` вставить из UI нельзя (graceful fallback в ast-render).
- Toast при ошибке paste/drop-загрузки картинки (plugin пишет console.warn; toast есть только у toolbar-кнопки).
- Позиционирование slash-/at-меню под курсором через `view.coordsAtPos`.
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/README.md
git commit -m "docs(ast-editor): update README for Phase 2d integration state"
```

---

## Task 12: Финальные гейты + self-review

- [ ] **Step 1: Полные гейты**

Run: `npm run lint && npm test && npm run build`
Expected: все три зелёные. Если красное — фиксить, не отключая правила.

- [ ] **Step 2: Проверить периметр диффа**

Run: `git diff --name-only main...HEAD` (если ветка от main) или `git status --short`
Expected: только файлы из Parallel-safety contract (Create + Modify). Особо проверить отсутствие: `src/api/schema.ts`, `package.json`, `src/utils/`, `src/components/ui/`, `src/app/`, `pickers/canvas-picker.tsx`, `pickers/actions.ts`, `extensions/`.

- [ ] **Step 3: Self-review checklist**

- [ ] `pickers/canvas-picker.tsx` НЕ удалён и НЕ изменён; `searchCanvases` в `actions.ts` на месте; тест CanvasPicker в `pickers.test.tsx` зелёный.
- [ ] В RefMenu нет категории canvas; в `extensions/marks/nav-ref.ts` и `drift-warn.ts` `canvas_ref` остался (их diff пуст).
- [ ] `onWillInsert` вызывается ДО чтения `selection.empty` в `apply` RefMenu.
- [ ] ImageButton вставляет attrs `{ storage_key, alt: "", caption: "", blockId: "" }` — ровно как paste/drop-плагин 2a.
- [ ] `forbidden` от uploadImage показывается branded-текстом «У вас нет прав …», не raw error.
- [ ] ast-render image: невалидный/отсутствующий `storage_key` → `data-unsupported="image"`, никакого `<img>`.
- [ ] `@ts-expect-error` в default-ветках `inline-renderer.tsx` и `block-renderer.tsx` сохранены, tsc не ругается на «unused @ts-expect-error».
- [ ] `resolveStorageUrl` импортируется в ast-render из `@/components/ast-editor/upload/storage-url` — никакой копии функции.
- [ ] Снапшот `ast-render.test.tsx.snap` пересоздан осознанно (дифф просмотрен), не вслепую.

- [ ] **Step 4: Доложить менеджеру**

Не пушить и не мержить самостоятельно: мерж в локальный `main` выполняет менеджер после code-review (протокол спеки §5). В отчёте указать выполненные отклонения от 2b (canvas отключён) и закрытые follow-up'ы 2a/2c.

---

## Что НЕ входит в этот план

- **Canvas целиком** (спека §4): фича canvases, развитие/удаление canvas-picker, `canvas_ref` в ast-render (fallback покрыт тестом в Task 10).
- **Toast в paste/drop-плагине** (отложено ещё в 2a): плагин — не-React код без доступа к toast-менеджеру; остаётся `console.warn`. Кандидат на follow-up (callback через buildExtensions).
- **Image picker** (выбор из уже загруженных) — у бека нет GET-листинга uploads; невозможно без бекенд-работы.
- **Рендер blockquote / table / thematic_break в ast-render** — редактор их создаёт, публичный рендер показывает через `data-unsupported`-fallback. Спека 2d ограничивает catch-up image + media_ref/comment_ref; gap эскалирован менеджеру как кандидат на отдельный mini-PR.
- **Позиционирование slash-/at-меню под курсором** (`view.coordsAtPos`) — improvement из 2c, не блокер.
- **Inline-citation attrs** (start_block_id, exact, prefix…) — design §6.1: MVP-picker только id.
- **Edit существующей nav-mark, recent/pinned items** — future (2b).
- **Schema-driven `static_files_base`** — backend story (design §9).
- **Миграция новых консьюмеров AstEditor** (lectures, comments) — волны 2-3.
