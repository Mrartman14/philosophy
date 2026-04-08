# Миграция фронтенда на бекенд API

**Дата:** 2026-04-08
**Статус:** Утверждён

## Контекст

Фронтенд (Next.js) переходит от статического экспорта с контентом в `public/` к серверному рендерингу с данными из бекенда (`philosophy-api`, Go + SQLite). Модель данных упрощается до бекендовой. Легаси-функционал (docx-viewer, экзамены, секции, упоминания, board_states) удаляется.

## Решения

- **Подход:** чистая перестройка (не инкрементальная миграция)
- **Рендеринг:** SSR + ISR (revalidate раз в час)
- **Деплой:** VPS, рядом с бекендом, за одним nginx
- **Типы:** кодогенерация из swagger.json через `openapi-typescript`
- **PWA:** остаётся, адаптируется
- **Материалы в `public/`:** пока не удаляются

## 1. Архитектура и деплой

### Инфраструктура

```
nginx (порт 80/443)
├── /api/*          -> philosophy-api (Go, порт 8080)
├── /static/files/* -> файловое хранилище (видео, заметки)
└── /*              -> Next.js (Node, порт 3000)
```

Три контейнера в `docker-compose.yml`: `api`, `frontend`, `nginx`. Один origin — нет CORS.

### Next.js конфиг

- Убираем `output: "export"`, `basePath`, `assetPrefix`
- Убираем скрипт `deploy: "gh-pages -d out"`
- Оставляем `reactStrictMode: true`, `images.unoptimized: true`

### Переменные окружения

- `API_URL` — внутренний URL бекенда для server-side fetch (например `http://api:8080`), не экспонируется клиенту
- `NEXT_PUBLIC_BASE_URL` — публичный URL сайта (для PWA manifest)

## 2. Данные и API-клиент

### Кодогенерация типов

Типы генерируются из swagger-спецификации бекенда. Ручных entity-файлов нет.

```json
{
  "generate-types": "openapi-typescript ${SWAGGER_URL:-../philosophy-api/docs/swagger/swagger.json} -o src/api/schema.ts"
}
```

- Локально: `npm run generate-types` — берёт из соседней папки
- Продакшн: `SWAGGER_URL=https://api.example.com/swagger/doc.json npm run generate-types`

### API-клиент

```
src/api/lecture-api.ts — server-side only, использует API_URL
```

Функции:
- `getLectures(page?, limit?, q?)` — список лекций
- `getLectureById(id)` — одна лекция
- `getTranscript(lectureId)` — транскрипт

Все используют `fetch` с `next: { revalidate: 3600 }`.

## 3. Страницы и маршруты

### Новая структура

```
src/app/
├── layout.tsx              — корневой layout (header, PWA)
├── page.tsx                — список лекций (server component)
├── lectures/
│   └── [id]/
│       └── page.tsx        — видео + транскрипт (server + client)
├── offline/page.tsx        — PWA
└── push/page.tsx           — PWA
```

### Главная (`/`)

Server component, `fetch` к `GET /api/lectures` с ISR. Список карточек (title, description, date). Пагинация.

### Страница лекции (`/lectures/[id]`)

Server component загружает лекцию и транскрипт параллельно (`Promise.all`). Передаёт данные в client component с видео-плеером и транскрипт-панелью. Роутинг по `id` (UUID) вместо `slug`.

## 4. Удаляемый код

### Компоненты

- `src/components/docx/` — весь каталог
- `src/components/dashboard/` — весь каталог
- `src/components/lecture/lecture-card.tsx`
- `src/components/lecture-page/lecture-view-observer.tsx`
- `src/components/lecture-list/lecture-list.tsx`
- `src/components/unique-content/` — весь каталог
- `src/components/app/video/board-panel.tsx`
- `src/components/shared/aside-menu/`
- `src/components/shared/scroll-progress-bar/`
- `src/components/shared/fav-button/`
- `src/components/shared/share-button/`
- `src/components/shared/mention.tsx`, `mention-info.tsx`
- `src/components/shared/expander.tsx`
- `src/components/shared/marquee.tsx`
- `src/components/shared/footer-portal/`
- `src/components/app/app-footer/`

### Утилиты и сервисы

- `src/utils/parse-docx.ts`
- `src/utils/calculate-reading-time.ts`
- `src/utils/group-by-nested-section.ts`
- `src/utils/generate-anchor-id.ts`
- `src/utils/philosophers.ts`
- `src/services/lecture-service/`
- `src/services/badge-service/`
- `src/services/sync-queue/`
- `src/components/providers/lecture-service-provider.tsx`

### Entities и API

- `src/entities/` — весь каталог
- `src/api/pages-api.ts`

### Стили

- `src/styles/themes/`
- `src/components/shared/tractate/`
- `src/components/shared/firework/`

### Зависимости (удалить из package.json)

- `mammoth`, `jsdom`, `dompurify` — парсинг docx
- `mermaid` — board_states
- `gh-pages` — деплой на GitHub Pages

### Зависимости (оставить)

- `react-yandex-metrika` — аналитика

## 5. PWA-адаптация

### Без изменений

- `src/hooks/use-install-prompt.ts`
- `src/hooks/use-push-subscription.ts`
- `src/hooks/use-register-sw.ts`
- `src/components/app/install-banner.tsx`
- `src/components/app/update-prompt.tsx`
- `src/components/app/network-indicator.tsx`
- `src/app/offline/page.tsx`
- `src/app/push/page.tsx`

### Адаптируется

- `public/sw.js` — кеширование API-запросов (network-first) вместо статических файлов, cache-first для видео
- `src/manifest.template.json` — убрать basePath, обновить start_url и scope
- `scripts/generate-sw-assets.mjs` — пересобрать список precache-ассетов

### Удаляется

- `src/services/sync-queue/` — синхронизация мутаций (viewed/fav)

## 6. Docker и nginx

### docker-compose.yml (в репо бекенда)

```yaml
services:
  api:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    env_file: .env

  frontend:
    build: ../philosophy
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://api:8080

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./data:/data:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
      - frontend
```

### nginx/default.conf

```nginx
server {
    listen 80;

    location /api/ {
        proxy_pass http://api:8080;
    }

    location /static/files/ {
        alias /data/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://frontend:3000;
    }
}
```

### Dockerfile (в репо philosophy)

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
