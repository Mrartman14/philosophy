# Frontend Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up the frontend — fix CSS architecture, standardize styling, remove dead code, optimize performance.

**Architecture:** Layered refactoring in 4 stages. Each task is an isolated commit. The app must build after every task.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript

---

### Task 1: Fix theme files

**Files:**
- Modify: `src/styles/themes/rebus.css`
- Modify: `src/styles/themes/kantian.css`

**Step 1: Rewrite rebus.css as the default theme**

`rebus.css` should define `:root` variables (light) and dark overrides. Remove the `@theme` block — it will live in globals.css.

```css
:root {
  --color-primary: oklch(72% 0.14 55);
  --color-background: #f6f2eb;
  --color-border: #c4cde0c6;
  --color-link: oklch(50% 0.15 250);
  --color-description: #6f798d;
  --color-text-pane: #c8cdd6ae;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #111a20;
    --color-border: #555c6a71;
    --color-link: oklch(70% 0.12 250);
    --color-description: #8b98b2;
    --color-text-pane: #00000092;
  }
}
```

**Step 2: Rewrite kantian.css as an opt-in theme**

Kantian variables scoped under `.theme-kantian` selector instead of `:root`:

```css
.theme-kantian {
  --color-primary: #775fa4;
  --color-background: #f7f8fc;
  --color-border: #d4cdc8;
  --color-link: #639fa9;
  --color-description: #817f91;
  --color-text-pane: #c8d0d4aa;
}

@media (prefers-color-scheme: dark) {
  .theme-kantian {
    --color-background: #1e1c2e;
    --color-border: #3e3b55;
    --color-link: #52868d;
    --color-description: #b0aed0;
    --color-text-pane: #2d2d7bb0;
  }
}
```

**Step 3: Verify files saved correctly**

Run: `cat src/styles/themes/rebus.css src/styles/themes/kantian.css`

---

### Task 2: Fix globals.css

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Rewrite globals.css**

Replace the entire file. One `@theme` block, one set of imports, no duplicates:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@import "../styles/themes/rebus.css";
@import "../styles/themes/kantian.css";

@theme {
  --color-primary: var(--color-primary);
  --color-background: var(--color-background);
  --color-border: var(--color-border);
  --color-link: var(--color-link);
  --color-description: var(--color-description);
  --color-text-pane: var(--color-text-pane);

  --spacing-header: 50px;
}

:root {
  color-scheme: light dark;

  --primary: var(--color-primary);
  --background: var(--color-background);
  --border: var(--color-border);
  --link: var(--color-link);
  --description: var(--color-description);
  --text-pane: var(--color-text-pane);
  --header-height: var(--spacing-header);
}

@media (forced-colors: active) {
  :root {
    --color-primary: AccentColor;
    --color-background: Canvas;
    --color-border: ButtonBorder;
    --color-link: LinkText;
    --color-description: GrayText;
  }

  *::target-text {
    background-color: Highlight;
    color: HighlightText;
  }
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL STYLES
   ═══════════════════════════════════════════════════════════════ */

* {
  scroll-margin-top: var(--spacing-header);
  scrollbar-color: var(--color-border) transparent;

  &::target-text {
    background-color: var(--color-primary);
    color: #fff;
  }
}

body:has(dialog[open]) {
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════
   CUSTOM COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

.fancy-link {
  position: relative;

  &::after {
    content: "→";
    position: absolute;
    left: calc(100% + 5px);
    transition: left 200ms ease-in-out;
  }

  &:hover::after,
  &:focus::after {
    left: calc(100% + 15px);
  }
}

@media (prefers-color-scheme: dark) {
  .sensitive-image {
    filter: brightness(75%);
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds with no CSS errors.

**Step 3: Commit**

```bash
git add src/styles/themes/rebus.css src/styles/themes/kantian.css src/app/globals.css
git commit -m "fix: clean up CSS theme architecture — rebus default, kantian opt-in"
```

---

### Task 3: Migrate app-header.css to Tailwind

**Files:**
- Modify: `src/components/app/app-header/app-header.tsx`
- Delete: `src/components/app/app-header/app-header.css`

**Step 1: Add Tailwind `before:` classes to the header element**

In `app-header.tsx`, the `<header>` already has `className="app-header sticky top-0 ..."`. The CSS rule targets `.app-header::before` with absolute positioning, bottom: calc(100% + 1px), width 100%, height 300px, and backdrop-filter blur(8px).

Replace import `"./app-header.css"` with nothing, and add `before:` Tailwind classes to the `<header>`:

```tsx
// Remove this line:
// import "./app-header.css";

// Update the <header> className — replace "app-header" with before: classes:
<header className="relative sticky top-0 z-50 w-full flex justify-center items-stretch gap-4 bg-(--background) border-t-0 border-b md:border-t border-(--border) h-(--header-height) before:content-[''] before:absolute before:bottom-[calc(100%+1px)] before:left-0 before:w-full before:h-[300px] before:backdrop-blur-[8px]">
```

**Step 2: Delete app-header.css**

```bash
rm src/components/app/app-header/app-header.css
```

**Step 3: Also remove commented-out Image import and block (lines 2, 20-28)**

Remove `// import Image from "next/image";` and the commented JSX block with Image.

**Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/app/app-header/
git commit -m "refactor: migrate app-header styles to Tailwind, remove dead code"
```

---

### Task 4: Migrate aside-menu.css to Tailwind

**Files:**
- Modify: `src/components/shared/aside-menu/aside-menu.tsx`
- Delete: `src/components/shared/aside-menu/aside-menu.css`

**Step 1: Inline the CSS rule**

The only CSS rule is `.aside-menu-item > a:hover ~ ul { border-color: var(--description); }`. This targets the `<ul>` sibling of a hovered `<a>` inside `<li class="aside-menu-item">`.

In Tailwind, use group pattern. In `AsideMenuItem`:

```tsx
// Remove import "./aside-menu.css";

// In the <li>:
<li className="group/menu-item">

// In the <ul> with children:
<ul className="pl-4 border-l border-(--border) group-has-[a:hover]/menu-item:border-(--description)">
```

**Step 2: Delete aside-menu.css**

```bash
rm src/components/shared/aside-menu/aside-menu.css
```

**Step 3: Build to verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/shared/aside-menu/
git commit -m "refactor: migrate aside-menu styles to Tailwind"
```

---

### Task 5: Migrate scroll-progress-bar.css to Tailwind

**Files:**
- Modify: `src/components/shared/scroll-progress-bar/scroll-progress-bar.tsx`
- Delete: `src/components/shared/scroll-progress-bar/scroll-progress-bar.css`

**Step 1: Move progress bar pseudo-element styles inline**

The CSS handles `<progress>` element styling across browsers: `::-webkit-progress-bar` (transparent bg), `::-webkit-progress-value` (primary color), `::-moz-progress-bar` (primary color).

These pseudo-element selectors are not supported by Tailwind. Move them into globals.css under the CUSTOM COMPONENTS section:

Add to `src/app/globals.css` before the closing:

```css
.scroll-progress-bar {
  appearance: none;
}
.scroll-progress-bar::-webkit-progress-bar {
  background-color: transparent;
}
.scroll-progress-bar::-webkit-progress-value {
  background-color: var(--primary);
}
.scroll-progress-bar::-moz-progress-bar {
  background-color: var(--primary);
}
```

**Step 2: Remove CSS import from component**

In `scroll-progress-bar.tsx`, remove line `import "./scroll-progress-bar.css";`

**Step 3: Delete scroll-progress-bar.css**

```bash
rm src/components/shared/scroll-progress-bar/scroll-progress-bar.css
```

**Step 4: Build to verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/components/shared/scroll-progress-bar/ src/app/globals.css
git commit -m "refactor: move scroll-progress-bar styles to globals.css, delete css file"
```

---

### Task 6: Clean up firework.css

**Files:**
- Modify: `src/components/shared/firework/firework.css`

**Step 1: Remove commented-out block and vendor-prefixed duplicates**

The file has:
- Lines 1-131: Entirely commented-out old firework implementation — **delete**
- Lines 132-199: Active `.pyro` styles with vendor-prefixed `animation` properties — **keep only unprefixed `animation`**
- Lines 201-265: 5 duplicates of `@keyframes bang` (`@-webkit-`, `@-moz-`, `@-o-`, `@-ms-`, standard) — **keep only standard `@keyframes bang`**
- Lines 266-315: 5 duplicates of `@keyframes gravity` — **keep only standard `@keyframes gravity`**
- Lines 316-470: 5 duplicates of `@keyframes position` — **keep only standard `@keyframes position`**

Result should be ~80 lines: `.pyro`, `.pyro > .before/.after`, `.pyro > .after`, `@keyframes bang`, `@keyframes gravity`, `@keyframes position`.

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/shared/firework/firework.css
git commit -m "refactor: clean up firework.css — remove commented code and vendor prefixes"
```

---

### Task 7: Delete dead code — CompactGrid, createGridLayout, NewLecturesProvider

**Files:**
- Delete: `src/components/shared/compact-grid/compact-grid.tsx`
- Delete: `src/components/shared/compact-grid/compact-grid.css`
- Delete: `src/utils/create-grid-layout.ts`
- Delete: `src/app/_providers/new-lectures-provider.tsx`
- Modify: `src/app/layout.tsx` (remove NewLecturesProvider import and usage)

**Step 1: Delete CompactGrid files and createGridLayout**

```bash
rm -rf src/components/shared/compact-grid/
rm src/utils/create-grid-layout.ts
```

**Step 2: Delete NewLecturesProvider and remove from layout**

```bash
rm src/app/_providers/new-lectures-provider.tsx
```

In `src/app/layout.tsx`:
- Remove line 10: `import { NewLecturesProvider } from "./_providers/new-lectures-provider";`
- Remove line 64: `<NewLecturesProvider />`

**Step 3: Remove commented-out code in other files**

In `src/app/lectures/[slug]/layout.tsx`:
- Remove line 5: `// import { Mention } from "@/components/shared/mention";`
- Remove line 8: `// import { PhilosopherIcon } from "@/assets/icons/philosopher-icon";`
- Remove lines 99-110: commented-out Mention/PhilosopherIcon JSX block

In `src/components/docx/docx-viewer/docx-viewer.tsx`:
- Remove line 8: `// import { SkeletonTextBlock } from ...`
- Remove lines 22, 27: `{/* {!loading && ( */}` and `{/* )} */}`

In `src/components/app/app-header/app-header.tsx` (if not already done in Task 3):
- Remove line 39: `{/* <NavigationMenu.Backdrop /> */}`

In `src/app/_providers/sw-provider.tsx`:
- Remove lines 47-60: commented-out `beforeinstallprompt` useLayoutEffect block

**Step 4: Build to verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove dead code — CompactGrid, NewLecturesProvider, commented blocks"
```

---

### Task 8: Fix dynamic Tailwind classes in lecture-list.tsx

**Files:**
- Modify: `src/components/lecture-list/lecture-list.tsx:29`

**Step 1: Replace dynamic padding class with inline style**

In `SectionRenderer`, line 29:

```tsx
// Before:
const paddingLeft = depth > 0 ? `pl-${Math.min(depth * 4, 12)}` : "";

// After (delete the line entirely and use style prop on the <section>):
```

Line 32, update the `<section>`:

```tsx
// Before:
<section className={`w-full grid ${paddingLeft}`} key={node.name}>

// After:
<section className="w-full grid" style={depth > 0 ? { paddingLeft: `${Math.min(depth, 3) * 1}rem` } : undefined} key={node.name}>
```

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/lecture-list/lecture-list.tsx
git commit -m "fix: replace dynamic Tailwind class with inline style in lecture-list"
```

---

### Task 9: Optimize LectureServiceProvider with Map + useMemo

**Files:**
- Modify: `src/components/providers/lecture-service-provider.tsx`

**Step 1: Add useMemo import and create lookup Map**

```tsx
import { useEffect, useMemo, useState, useCallback } from "react";
```

After `const { lectures } = useAppPageConfig();`, add:

```tsx
const lectureMap = useMemo(
  () => new Map(lectures.map((l) => [l.slug, l])),
  [lectures]
);
```

**Step 2: Deduplicate fetchFav — single function used everywhere**

Replace the entire component body from line 30 onwards. The `fetchFav` function (lines 30-38) and the duplicate `fetchFavLectures` inside useEffect (lines 54-61) should become one `useCallback`:

```tsx
const fetchFav = useCallback(async () => {
  const ids = await lectureService.getFavLectureIds();
  if (ids.length === 0) return setFavLectures([]);
  setFavLectures(ids.map((id) => lectureMap.get(id)).filter((x) => !!x));
}, [lectureMap]);

const onSelectFav = useCallback(
  (id: string) => lectureService.setFavLectureId(id).then(fetchFav),
  [fetchFav]
);

useEffect(() => {
  const fetchLastViews = async () => {
    const ids = await lectureService.getLastViewedLectureIds();
    if (ids.length === 0) return;
    setLastViewedLectures(ids.map((id) => lectureMap.get(id)).filter((x) => !!x));
  };

  fetchLastViews();
  fetchFav();
}, [lectureMap, fetchFav]);
```

**Step 3: Build to verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/providers/lecture-service-provider.tsx
git commit -m "perf: optimize LectureServiceProvider — Map lookup, deduplicate fetchFav"
```

---

### Task 10: Extract useActiveSection hook from AsideMenu

**Files:**
- Create: `src/components/shared/aside-menu/use-active-section.ts`
- Modify: `src/components/shared/aside-menu/aside-menu.tsx`

**Step 1: Create the hook**

Extract the scroll-tracking logic (lines 28-79 of aside-menu.tsx) into a dedicated hook:

```tsx
"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash/throttle";
import type { AsideNavItem } from "./aside-menu";

function flattenItems(items: AsideNavItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
    if (item.children?.length) {
      ids.push(...flattenItems(item.children));
    }
  }
  return ids;
}

export function useActiveSection(
  items: AsideNavItem[],
  scrollContainerRef: React.RefObject<HTMLUListElement | null>
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemIds = useMemo(() => flattenItems(items), [items]);
  const elementCache = useRef<Map<string, HTMLElement>>(new Map());

  useLayoutEffect(() => {
    setActiveId(items[0]?.id ?? null);
    elementCache.current.clear();
  }, [items]);

  useLayoutEffect(() => {
    const getElement = (id: string): HTMLElement | null => {
      let el = elementCache.current.get(id);
      if (!el) {
        el = document.getElementById(id) ?? undefined;
        if (el) elementCache.current.set(id, el);
      }
      return el ?? null;
    };

    const listen = throttle(() => {
      for (const id of itemIds) {
        const el = getElement(id);
        if (!el) continue;
        const { top, left } = el.getBoundingClientRect();
        if (top >= 0 && left >= 0) {
          setActiveId(id);

          const container = scrollContainerRef.current;
          if (container) {
            const anchorEl = document.getElementById(`${id}-anchor`);
            if (anchorEl) {
              const containerRect = container.getBoundingClientRect();
              const anchorRect = anchorEl.getBoundingClientRect();
              container.scrollTo({
                top: container.scrollTop + (anchorRect.top - containerRect.top) - 16,
                behavior: "smooth",
              });
            }
          }
          break;
        }
      }
    }, 100);

    listen();
    document.addEventListener("scroll", listen);
    return () => document.removeEventListener("scroll", listen);
  }, [itemIds, scrollContainerRef]);

  return activeId;
}
```

**Step 2: Simplify aside-menu.tsx**

Replace the two `useLayoutEffect` blocks (lines 24-79) with the hook call:

```tsx
const intersected = useActiveSection(items, stickyRef);
```

Remove `useState` for `intersected`, remove `throttle` import (moved to hook), remove the `setIntersected` calls.

**Step 3: Build to verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/shared/aside-menu/
git commit -m "refactor: extract useActiveSection hook from AsideMenu"
```

---

### Task 11: Final build + visual check

**Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with zero errors.

**Step 2: Dev server visual check**

Run: `npm run dev`
Manually verify:
- Home page loads, lecture cards render
- Lecture page renders with scroll progress bar
- Aside menu highlights active section on scroll
- App header blur effect works on mobile PWA area
- Firework animation works (if triggerable)
- Dark mode looks correct

**Step 3: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: post-cleanup fixups"
```
