# Философия-ликбез — фронтенд

Next.js-приложение для архива занятий курса «Философия-ликбез».

## Стек

| Слой | Технология |
| --- | --- |
| Фреймворк | Next.js 16 (App Router, RSC, Server Actions) |
| Рантайм UI | React 19, TypeScript (strict) |
| Стили | Tailwind CSS v4, Geist (via `next/font/google`) |
| Компоненты | Base UI |
| Валидация | Zod 4 |
| Тесты | Vitest 4 + Testing Library |
| API-клиент | openapi-fetch (types из `src/api/schema.ts`) |
| Бэкенд | Отдельный Go-сервис **philosophy-api** |

## Начало работы

### Требования

**Только pnpm.** Использование `npm` или `yarn` сломает тулчейн: `pnpm` использует `node-linker=hoisted` для корректной дедупликации ProseMirror/Tiptap (подробнее — [`.npmrc`](.npmrc) и [`CLAUDE.md`](CLAUDE.md)).

```bash
# Установка зависимостей
pnpm install

# Запуск dev-сервера (Turbopack, порт 3001)
pnpm dev
```

Открой <http://localhost:3001> в браузере.

### Доступные команды

| Команда | Что делает |
| --- | --- |
| `pnpm dev` | Dev-сервер на порту **3001** (Turbopack) |
| `pnpm build` | Продакшн-сборка (генерирует SW-ассеты + `next build`) |
| `pnpm start` | Запуск собранного приложения (порт **3000**) |
| `pnpm lint` | ESLint по `src/` |
| `pnpm typecheck` | TypeScript без эмита |
| `pnpm test` | Vitest (разовый прогон) |
| `pnpm test:watch` | Vitest в watch-режиме |
| `pnpm generate:api` | Регенерация `src/api/schema.ts` из swagger-файла бэкенда |

## Архитектура

Проект построен на **feature-slice архитектуре**:

```text
src/features/<entity>/
  index.ts          # публичный API слайса
  api.ts            # server-only fetchers
  actions.ts        # "use server" мутации
  permissions.ts    # доменные can*-хелперы
  schemas.ts        # Zod-схемы для FormData
  types.ts          # сужения из src/api/schema.ts
  client.ts         # client-safe вход (не реэкспортит server-only)
  ui/               # компоненты слайса
  *.test.ts         # vitest-тесты
```

Канонический референс: [`docs/frontend-conventions.md`](docs/frontend-conventions.md).  
Шаблон для новых фич: [`src/features/_template/`](src/features/_template/) + его [`README.md`](src/features/_template/README.md).

### RBAC

Проект использует серверный RBAC: права приходят с бэкенда через `getMe()`, на фронте не вычисляются.

- В server actions — `requireCapability(me, canX)`
- В server components UI — `canX(me)` → boolean-проп в client-компоненты

Подробнее — раздел RBAC в [`CLAUDE.md`](CLAUDE.md).

### Генерация API-типов

Типы генерируются из swagger-файла бэкенда:

```bash
pnpm generate:api
```

Файл `src/api/schema.ts` — заморожен, регенерируется только координированно (отдельным PR).

## Деплой

Проект деплоится через **Docker**. Образ собирается двухстадийным билдом (`pnpm build` → `pnpm start`). Контейнер слушает порт **3000**.

```bash
docker build -t philosophy-frontend .
docker run -p 3000:3000 philosophy-frontend
```

Подробности сборки — [`Dockerfile`](Dockerfile).

## Quality gate

Перед PR всё должно быть зелёным:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Правила проекта

Полные правила (параллельная работа агентов, запретные зоны, kebab-case, деструктивные git-операции) — [`CLAUDE.md`](CLAUDE.md).
