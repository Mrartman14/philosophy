# Backend Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Перевести фронтенд с статического экспорта (public/ + fs.readFile) на SSR/ISR с данными из philosophy-api. Упростить до двух страниц: список лекций и страница лекции (видео + транскрипт). Сохранить PWA.

**Architecture:** Next.js SSR + ISR (revalidate 3600s). API-клиент делает server-side fetch к внутреннему `API_URL`. Типы генерируются из swagger.json бекенда через openapi-typescript. Деплой — Docker-контейнер за nginx рядом с бекендом.

**Tech Stack:** Next.js 16 (App Router, Server Components), openapi-typescript, Docker, nginx

**Design doc:** `docs/plans/2026-04-08-backend-migration-design.md`

---

### Task 1: Кодогенерация типов из swagger

**Files:**
- Create: `src/api/schema.ts` (сгенерированный)
- Modify: `package.json` (добавить скрипт и devDependency)

**Step 1: Установить openapi-typescript**

Run: `npm install -D openapi-typescript`

**Step 2: Добавить скрипт генерации в package.json**

В секцию `"scripts"` добавить:
```json
"generate-types": "openapi-typescript ${SWAGGER_URL:-../philosophy-api/docs/swagger/swagger.json} -o src/api/schema.ts"
```

**Step 3: Сгенерировать типы**

Run: `npm run generate-types`
Expected: файл `src/api/schema.ts` создан с типами `lecture.Lecture`, `lecture.ListResult`, `transcript.Transcript`, `transcript.Segment` и др.

**Step 4: Commit**

```bash
git add src/api/schema.ts package.json package-lock.json
git commit -m "feat: add openapi-typescript codegen from backend swagger"
```

---

### Task 2: API-клиент

**Files:**
- Create: `src/api/lecture-api.ts`

**Step 1: Создать API-клиент**

```typescript
// src/api/lecture-api.ts
import type { components } from "./schema";

type Lecture = components["schemas"]["lecture.Lecture"];
type ListResult = components["schemas"]["lecture.ListResult"];
type Transcript = components["schemas"]["transcript.Transcript"];

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export async function getLectures(
  page = 1,
  limit = 20,
  q?: string
): Promise<ListResult> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (q) params.set("q", q);

  const res = await fetch(`${API_URL}/api/lectures?${params}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Failed to fetch lectures: ${res.status}`);
  return res.json();
}

export async function getLectureById(id: string): Promise<Lecture> {
  const res = await fetch(`${API_URL}/api/lectures/${id}`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Failed to fetch lecture ${id}: ${res.status}`);
  return res.json();
}

export async function getTranscript(lectureId: string): Promise<Transcript> {
  const res = await fetch(`${API_URL}/api/lectures/${lectureId}/transcript`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok)
    throw new Error(`Failed to fetch transcript for ${lectureId}: ${res.status}`);
  return res.json();
}
```

**Step 2: Проверить что TypeScript компилирует без ошибок**

Run: `npx tsc --noEmit src/api/lecture-api.ts`
Expected: без ошибок (или минимальные, связанные с отсутствием next-типов для `fetch`)

**Step 3: Commit**

```bash
git add src/api/lecture-api.ts
git commit -m "feat: add API client for backend lectures and transcripts"
```

---

### Task 3: Next.js конфиг — убрать static export

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json` (убрать deploy скрипт)

**Step 1: Обновить next.config.ts**

Заменить содержимое на:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
```

Убрано: `output: "export"`, `basePath`, `assetPrefix`.

**Step 2: Убрать deploy скрипт из package.json**

Удалить строку `"deploy": "gh-pages -d out"` из секции `"scripts"`.

**Step 3: Commit**

```bash
git add next.config.ts package.json
git commit -m "chore: remove static export config and gh-pages deploy"
```

---

### Task 4: Удалить легаси entities и api

**Files:**
- Delete: `src/entities/page-data.ts`
- Delete: `src/entities/video-lecture.ts`
- Delete: `src/api/pages-api.ts`

**Step 1: Удалить файлы**

```bash
rm src/entities/page-data.ts src/entities/video-lecture.ts src/api/pages-api.ts
```

**Step 2: Commit**

```bash
git add src/entities/page-data.ts src/entities/video-lecture.ts src/api/pages-api.ts
git commit -m "refactor: remove legacy entity types and filesystem API"
```

---

### Task 5: Удалить легаси сервисы и утилиты

**Files:**
- Delete: `src/services/lecture-service/lecture-service.ts`
- Delete: `src/services/badge-service/badge-service.ts`
- Delete: `src/services/sync-queue/sync-queue.ts`
- Delete: `src/components/providers/lecture-service-provider.tsx`
- Delete: `src/utils/parse-docx.ts`
- Delete: `src/utils/calculate-reading-time.ts`
- Delete: `src/utils/group-by-nested-section.ts`
- Delete: `src/utils/generate-anchor-id.ts`
- Delete: `src/utils/philosophers.ts`

**Step 1: Удалить файлы**

```bash
rm src/services/lecture-service/lecture-service.ts
rm src/services/badge-service/badge-service.ts
rm src/services/sync-queue/sync-queue.ts
rm src/components/providers/lecture-service-provider.tsx
rm src/utils/parse-docx.ts
rm src/utils/calculate-reading-time.ts
rm src/utils/group-by-nested-section.ts
rm src/utils/generate-anchor-id.ts
rm src/utils/philosophers.ts
```

**Step 2: Commit**

```bash
git add src/services/ src/components/providers/ src/utils/parse-docx.ts src/utils/calculate-reading-time.ts src/utils/group-by-nested-section.ts src/utils/generate-anchor-id.ts src/utils/philosophers.ts
git commit -m "refactor: remove legacy services, providers, and utilities"
```

---

### Task 6: Удалить легаси компоненты

**Files:**
- Delete: `src/components/docx/` (весь каталог)
- Delete: `src/components/dashboard/` (весь каталог)
- Delete: `src/components/lecture/lecture-card.tsx`
- Delete: `src/components/lecture-page/lecture-view-observer.tsx`
- Delete: `src/components/lecture-list/lecture-list.tsx`
- Delete: `src/components/unique-content/` (весь каталог)
- Delete: `src/components/app/video/board-panel.tsx`
- Delete: `src/components/shared/aside-menu/` (весь каталог)
- Delete: `src/components/shared/scroll-progress-bar/` (весь каталог)
- Delete: `src/components/shared/fav-button/` (весь каталог)
- Delete: `src/components/shared/share-button/` (весь каталог)
- Delete: `src/components/shared/mention.tsx`
- Delete: `src/components/shared/mention-info.tsx`
- Delete: `src/components/shared/expander.tsx`
- Delete: `src/components/shared/marquee.tsx`
- Delete: `src/components/shared/footer-portal/` (весь каталог)
- Delete: `src/components/shared/tractate/` (весь каталог)
- Delete: `src/components/shared/firework/` (весь каталог)
- Delete: `src/components/app/app-footer/` (весь каталог)

**Step 1: Удалить каталоги и файлы**

```bash
rm -rf src/components/docx
rm -rf src/components/dashboard
rm -rf src/components/lecture
rm -rf src/components/lecture-page
rm -rf src/components/lecture-list
rm -rf src/components/unique-content
rm src/components/app/video/board-panel.tsx
rm -rf src/components/shared/aside-menu
rm -rf src/components/shared/scroll-progress-bar
rm -rf src/components/shared/fav-button
rm -rf src/components/shared/share-button
rm src/components/shared/mention.tsx
rm src/components/shared/mention-info.tsx
rm src/components/shared/expander.tsx
rm src/components/shared/marquee.tsx
rm -rf src/components/shared/footer-portal
rm -rf src/components/shared/tractate
rm -rf src/components/shared/firework
rm -rf src/components/app/app-footer
```

**Step 2: Commit**

```bash
git add src/components/
git commit -m "refactor: remove legacy UI components (docx, dashboard, exams, board)"
```

---

### Task 7: Удалить легаси страницы и маршруты

**Files:**
- Delete: `src/app/lectures/` (весь каталог — будет пересоздан в Task 10)
- Delete: `src/app/exams/` (весь каталог)
- Delete: `src/app/video/` (весь каталог)

**Step 1: Удалить каталоги**

```bash
rm -rf src/app/lectures
rm -rf src/app/exams
rm -rf src/app/video
```

**Step 2: Commit**

```bash
git add src/app/lectures src/app/exams src/app/video
git commit -m "refactor: remove legacy page routes (lectures, exams, video)"
```

---

### Task 8: Удалить легаси стили и зависимости

**Files:**
- Delete: `src/styles/themes/kantian.css`
- Delete: `src/styles/themes/rebus.css`
- Modify: `src/app/globals.css` (убрать импорты тем и стили scroll-progress-bar)
- Modify: `package.json` (убрать зависимости)

**Step 1: Удалить файлы тем**

```bash
rm -rf src/styles
```

**Step 2: Обновить globals.css**

Убрать строки 4-5:
```css
@import "../styles/themes/rebus.css";
@import "../styles/themes/kantian.css";
```

Убрать строки 89-100 (стили `.scroll-progress-bar`).

**Step 3: Удалить зависимости**

Run: `npm uninstall mammoth jsdom dompurify mermaid gh-pages`

**Step 4: Commit**

```bash
git add src/styles src/app/globals.css package.json package-lock.json
git commit -m "refactor: remove legacy themes and unused dependencies"
```

---

### Task 9: Переписать провайдер и навигацию

**Files:**
- Modify: `src/app/_providers/app-page-provider.tsx`
- Modify: `src/app/_providers/app-page-client-provider.tsx`
- Modify: `src/components/app/app-nav.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Переписать app-page-client-provider.tsx**

Контекст теперь хранит только список лекций (без exams, sections, mentions):

```typescript
"use client";

import { createContext, useContext } from "react";
import type { components } from "@/api/schema";

type Lecture = components["schemas"]["lecture.Lecture"];

type AppContext = {
  lectures: Lecture[];
};

const AppPageContext = createContext<AppContext>({ lectures: [] });

export const AppPageClientProvider: React.FC<
  React.PropsWithChildren<{ lectures: Lecture[] }>
> = ({ children, lectures }) => {
  return <AppPageContext value={{ lectures }}>{children}</AppPageContext>;
};

export const useAppPageConfig = () => useContext(AppPageContext);
```

**Step 2: Переписать app-page-provider.tsx**

```typescript
import { getLectures } from "@/api/lecture-api";
import { AppPageClientProvider } from "./app-page-client-provider";

export const AppPageProvider: React.FC<React.PropsWithChildren> = async ({
  children,
}) => {
  const result = await getLectures(1, 100);

  return (
    <AppPageClientProvider lectures={result.data}>
      {children}
    </AppPageClientProvider>
  );
};
```

**Step 3: Переписать app-nav.tsx**

Убрать: exams, sections, mentions, `groupByNestedSection`, `useParams`. Оставить один пункт навигации «Лекции» — плоский список ссылок на `/lectures/{id}`:

```typescript
"use client";

import Link from "next/link";
import { NavigationMenu } from "@base-ui/react/navigation-menu";

import { ChevronDownIcon } from "@/assets/icons/chevron-down-icon";
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

export const AppNav: React.FC = () => {
  const { lectures } = useAppPageConfig();

  return (
    <NavigationMenu.Item className="flex items-stretch justify-center">
      <NavigationMenu.Trigger className={triggerClassName}>
        <span className="tracking-wide">Лекции</span>
        <NavigationMenu.Icon className={chevronClassName}>
          <ChevronDownIcon />
        </NavigationMenu.Icon>
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className={contentAnimationClassName}>
        <ol className={contentListClassName}>
          {lectures.map((item) => {
            const href = `/lectures/${item.id}`;
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  className="group block p-2 hover:bg-(--text-pane) font-semibold focus:outline-0"
                >
                  <span className="group-hover:underline group-focus:underline">
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="block text-xs text-(--description)">
                      {item.description}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
};

const chevronClassName =
  "text-xs transition-transform duration-200 ease-in-out data-[popup-open]:rotate-180";

const contentListClassName =
  "grid grid-cols-1 gap-2 w-[90vw] md:w-[500px] max-h-[70vh] overflow-y-scroll";

const triggerClassName =
  "md:text-base flex items-center justify-center gap-1 md:gap-1 " +
  "data-[popup-open]:text-inherit text-(--description) font-semibold select-none";

const contentAnimationClassName =
  "transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)] " +
  "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 " +
  "data-[starting-style]:data-[activation-direction=left]:translate-x-[-50%] " +
  "data-[starting-style]:data-[activation-direction=right]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=left]:translate-x-[50%] " +
  "data-[ending-style]:data-[activation-direction=right]:translate-x-[-50%]";
```

**Step 4: Обновить layout.tsx**

Убрать `AppFooter`, убрать `basePath` из metadata, обновить grid (убрать `auto` для footer):

```typescript
import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppPageProvider } from "./_providers/app-page-provider";
import { AppHeader } from "@/components/app/app-header/app-header";
import { InstallBanner } from "@/components/app/install-banner";
import { UpdatePrompt } from "@/components/app/update-prompt";
import { YandexMetrika } from "@/components/yandex-metrika/yandex-metrika";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const geistClasses = "font-[family-name:var(--font-geist-sans)]";

export const metadata: Metadata = {
  title: "Философия-ликбез",
  description: "Архив занятий курса Философия-ликбез",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "ФЛБЗ",
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <meta
          name="theme-color"
          content="#f8f8f8"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#111a20"
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body
        className={`
          root bg-(--background)
          ${geistSans.variable} ${geistMono.variable} antialiased
          grid grid-rows-[var(--header-height)_1fr] items-stretch justify-items-center min-h-screen
          ${geistClasses}
          `}
      >
        <AppPageProvider>
          <AppHeader />
          <InstallBanner />
          <main className="w-[100vw] max-w-[100vw] lg:w-full lg:max-w-screen-lg flex flex-col items-center md:border-l md:border-r md:border-(--border)">
            {children}
          </main>
        </AppPageProvider>
        <UpdatePrompt />
        <Suspense>
          <YandexMetrika />
        </Suspense>
      </body>
    </html>
  );
}
```

**Step 5: Commit**

```bash
git add src/app/_providers/ src/components/app/app-nav.tsx src/app/layout.tsx
git commit -m "refactor: rewrite providers and nav to use backend API types"
```

---

### Task 10: Главная страница — список лекций

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Переписать page.tsx**

```typescript
import Link from "next/link";
import { getLectures } from "@/api/lecture-api";

export default async function Home() {
  const result = await getLectures(1, 100);

  return (
    <div className="w-full flex flex-col gap-6 pb-4">
      <h1 className="text-5xl font-black p-4" style={{ margin: 0 }}>
        Лекции
      </h1>
      <ul className="grid grid-cols-1 gap-2 px-4">
        {result.data.map((lecture) => (
          <li key={lecture.id}>
            <Link
              href={`/lectures/${lecture.id}`}
              className="block p-4 rounded-lg border border-(--border) hover:bg-(--text-pane) transition-colors"
            >
              <h2 className="text-lg font-semibold">{lecture.title}</h2>
              {lecture.description && (
                <p className="text-sm text-(--description) mt-1">
                  {lecture.description}
                </p>
              )}
              {lecture.date && (
                <time className="text-xs text-(--description) mt-2 block">
                  {new Date(lecture.date).toLocaleDateString("ru-RU")}
                </time>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 2: Проверить сборку**

Run: `npx next build`
Expected: сборка проходит (при условии что бекенд доступен по API_URL; если нет — ожидаем ошибку fetch, это нормально на данном этапе)

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: rewrite home page — lecture list from backend API"
```

---

### Task 11: Адаптировать transcript-panel и use-synced-player

**Files:**
- Modify: `src/components/app/video/transcript-panel.tsx`
- Modify: `src/components/app/video/use-synced-player.ts`

**Step 1: Обновить transcript-panel.tsx**

Заменить импорт типа на сгенерированный:

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { components } from "@/api/schema";

type Segment = components["schemas"]["transcript.Segment"];

interface TranscriptPanelProps {
  segments: Segment[];
  currentSegmentId: number | null;
  onSeek: (time: number) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  segments,
  currentSegmentId,
  onSeek,
}) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSegmentId]);

  return (
    <div className="flex flex-col gap-1 p-4">
      {segments.map((item) => {
        const isActive = item.id === currentSegmentId;
        return (
          <button
            key={item.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(item.start)}
            className={`text-left p-2 rounded-lg transition-colors cursor-pointer ${
              isActive
                ? "bg-(--color-primary)/10 border-l-2 border-(--color-primary)"
                : "hover:bg-(--color-border)/30"
            }`}
          >
            <span className="text-xs text-(--description) block">
              {item.speaker}
            </span>
            <span className="text-sm">{item.text}</span>
          </button>
        );
      })}
    </div>
  );
};
```

**Step 2: Обновить use-synced-player.ts**

Убрать BoardState, работать с сегментами:

```typescript
"use client";

import { useEffect, useState, useCallback, RefObject } from "react";
import type { components } from "@/api/schema";

type Segment = components["schemas"]["transcript.Segment"];

function findByTime(items: Segment[], time: number): Segment | null {
  return items.find((item) => time >= item.start && time <= item.end) ?? null;
}

export function useSyncedPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  segments: Segment[]
) {
  const [currentSegmentId, setCurrentSegmentId] = useState<number | null>(null);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = time;
      }
    },
    [videoRef]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      const segment = findByTime(segments, time);
      setCurrentSegmentId(segment?.id ?? null);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [videoRef, segments]);

  return { currentSegmentId, seekTo };
}
```

**Step 3: Commit**

```bash
git add src/components/app/video/transcript-panel.tsx src/components/app/video/use-synced-player.ts
git commit -m "refactor: update transcript panel and synced player to use generated types"
```

---

### Task 12: Страница лекции — видео + транскрипт

**Files:**
- Create: `src/app/lectures/[id]/page.tsx`

**Step 1: Создать директорию и страницу**

```bash
mkdir -p src/app/lectures/\[id\]
```

```typescript
// src/app/lectures/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLectureById, getLectures, getTranscript } from "@/api/lecture-api";
import { LecturePlayer } from "./lecture-player";

interface LecturePageParams {
  id: string;
}

export async function generateStaticParams(): Promise<LecturePageParams[]> {
  const result = await getLectures(1, 100);
  return result.data.map((lecture) => ({ id: lecture.id }));
}

type GenerateMetadataProps = {
  params: Promise<LecturePageParams>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture.title };
}

interface PageProps {
  params: Promise<LecturePageParams>;
}
export default async function LecturePage({ params }: PageProps) {
  const { id } = await params;

  let lecture, transcript;
  try {
    [lecture, transcript] = await Promise.all([
      getLectureById(id),
      getTranscript(id),
    ]);
  } catch {
    return notFound();
  }

  return (
    <LecturePlayer
      lecture={lecture}
      segments={transcript.segments}
    />
  );
}
```

**Step 2: Создать client component LecturePlayer**

```typescript
// src/app/lectures/[id]/lecture-player.tsx
"use client";

import { useRef } from "react";
import type { components } from "@/api/schema";
import { useSyncedPlayer } from "@/components/app/video/use-synced-player";
import { TranscriptPanel } from "@/components/app/video/transcript-panel";

type Lecture = components["schemas"]["lecture.Lecture"];
type Segment = components["schemas"]["transcript.Segment"];

interface LecturePlayerProps {
  lecture: Lecture;
  segments: Segment[];
}

export const LecturePlayer: React.FC<LecturePlayerProps> = ({
  lecture,
  segments,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentSegmentId, seekTo } = useSyncedPlayer(videoRef, segments);

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1fr] min-h-screen">
      <div className="order-2 md:order-1 overflow-y-auto md:max-h-screen">
        <TranscriptPanel
          segments={segments}
          currentSegmentId={currentSegmentId}
          onSeek={seekTo}
        />
      </div>
      <div className="order-1 md:order-2 md:sticky md:top-0 md:h-screen md:overflow-y-auto border-l border-(--border)">
        {lecture.video_url ? (
          <video
            ref={videoRef}
            controls
            className="w-full aspect-video"
            src={lecture.video_url}
            preload="metadata"
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-(--text-pane) text-(--description)">
            Видео недоступно
          </div>
        )}
        <div className="p-4">
          <h1 className="text-xl font-bold">{lecture.title}</h1>
          {lecture.description && (
            <p className="text-sm text-(--description) mt-2">
              {lecture.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
```

**Step 3: Commit**

```bash
git add src/app/lectures/
git commit -m "feat: add lecture page with video player and synced transcript"
```

---

### Task 13: PWA — адаптировать service worker

**Files:**
- Modify: `src/sw.template.js`
- Modify: `src/manifest.template.json`
- Modify: `scripts/generate-sw-assets.mjs`

**Step 1: Обновить manifest.template.json**

Заменить `__BASE_PATH__` на пустую строку (basePath больше нет):

```json
{
  "name": "Философия ликбез",
  "short_name": "ФЛБЗ",
  "description": "Архив занятий курса Философия-ликбез",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#f8f8f8",
  "background_color": "#111a20",
  "icons": [
    {
      "src": "./web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "./web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

**Step 2: Обновить sw.template.js**

Заменить `PAGE_DATA_CACHE` и `LECTURES_PAGE_CACHE` на `API_CACHE`. Добавить стратегию network-first для `/api/` запросов. Убрать `page-data.json` логику:

```javascript
const BASE_PATH = '__BASE_PATH__';
const SW_VERSION = '__SW_VERSION__';

const CACHE_PREFIX = 'flbz';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const NEXT_ASSETS_CACHE = `${CACHE_PREFIX}-next-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, NEXT_ASSETS_CACHE, API_CACHE, IMAGE_CACHE];

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/logo.png`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.webmanifest`,
];

const OFFLINE_URL = `${BASE_PATH}/offline.html`;
const IMAGE_CACHE_LIMIT = 100;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((e) => console.error('[SW] install error:', e))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch((e) => console.error('[SW] activate error:', e))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API requests — network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Next.js static chunks — cache-first
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(cacheFirst(request, NEXT_ASSETS_CACHE));
    return;
  }

  // Precached static assets — cache-first
  if (STATIC_ASSETS.some((asset) => url.pathname === asset || url.pathname + '/' === asset)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Images — cache-first with LRU
  if (url.pathname.match(/\.(jpeg|jpg|png|webp)$/)) {
    event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT));
    return;
  }

  // Everything else — network with offline fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

async function cacheFirstWithLimit(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
      trimCache(cacheName, limit);
    }
    return response;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - limit;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || `${BASE_PATH}/logo.png`,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || `${BASE_PATH}/`,
    },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || `${self.location.origin}${BASE_PATH}/`;
  event.waitUntil(clients.openWindow(url));
});
```

**Step 3: Упростить generate-sw-assets.mjs**

Убрать `__BASE_PATH__` замену (basePath пуст), оставить только версионирование:

```javascript
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const version = Date.now().toString(36);

// Generate sw.js
const swTemplate = readFileSync(resolve(root, 'src/sw.template.js'), 'utf-8');
const sw = swTemplate
  .replaceAll('__BASE_PATH__', '')
  .replaceAll('__SW_VERSION__', version);
writeFileSync(resolve(root, 'public/sw.js'), sw);

// Generate manifest.webmanifest
const manifestTemplate = readFileSync(resolve(root, 'src/manifest.template.json'), 'utf-8');
writeFileSync(resolve(root, 'public/manifest.webmanifest'), manifestTemplate);

console.log(`[generate-sw-assets] version="${version}"`);
```

**Step 4: Регенерировать SW и manifest**

Run: `node scripts/generate-sw-assets.mjs`

**Step 5: Commit**

```bash
git add src/sw.template.js src/manifest.template.json scripts/generate-sw-assets.mjs public/sw.js public/manifest.webmanifest
git commit -m "refactor(pwa): adapt service worker for API-based architecture"
```

---

### Task 14: Dockerfile для фронтенда

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: Создать Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
```

**Step 2: Создать .dockerignore**

```
node_modules
.next
out
.git
*.md
docs
```

**Step 3: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add Dockerfile for Next.js SSR deployment"
```

---

### Task 15: Финальная проверка сборки

**Step 1: Проверить TypeScript**

Run: `npx tsc --noEmit`
Expected: без ошибок

**Step 2: Проверить ESLint**

Run: `npm run lint`
Expected: без ошибок (или только warnings)

**Step 3: Проверить сборку Next.js**

Run: `API_URL=http://localhost:8080 npx next build`
Expected: сборка проходит (если бекенд запущен) или понятная ошибка fetch (если бекенд не запущен)

**Step 4: Исправить ошибки если есть, commit**

```bash
git add -u
git commit -m "fix: resolve build errors after backend migration"
```
