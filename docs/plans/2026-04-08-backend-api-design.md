# Philosophy API — Backend Design

**Дата**: 2026-04-08
**Статус**: утверждён

## Обзор

Go-монолит в отдельном репозитории (`philosophy-api`). Файловое хранилище + CRUD API для управления лекциями, конспектами и расшифровками. Админка для нескольких преподавателей с JWT-авторизацией.

## Архитектура

Модульный монолит со слоями handler → service → repository. Зависимости через интерфейсы.

```
philosophy-api/
├── cmd/server/
├── internal/
│   ├── config/
│   ├── auth/           # JWT, bcrypt, middleware
│   ├── lecture/         # CRUD лекций
│   ├── transcript/      # расшифровки
│   ├── storage/         # интерфейс Storage + реализации
│   │   ├── storage.go   # интерфейс
│   │   ├── local.go
│   │   └── s3.go
│   └── middleware/       # CORS, auth, logging, recovery
├── migrations/
├── api/                  # OpenAPI-спецификация
├── Dockerfile
├── Makefile
└── go.mod
```

## Модели данных

### Lecture

| Поле        | Тип       | Описание                     |
|-------------|-----------|------------------------------|
| id          | uuid      | PK                           |
| title       | string    |                              |
| description | string    |                              |
| date        | timestamp |                              |
| video_key   | string    | ключ файла в storage         |
| notes_key   | string    | ключ конспекта в storage     |
| created_at  | timestamp |                              |
| updated_at  | timestamp |                              |

### Transcript

| Поле       | Тип    | Описание                |
|------------|--------|-------------------------|
| id         | uuid   | PK                      |
| lecture_id | uuid   | FK → Lecture             |
| segments   | JSON   | массив сегментов        |
| created_at | timestamp |                       |
| updated_at | timestamp |                       |

Сегмент: `{id, start, end, speaker, text}`

### Admin

| Поле          | Тип       | Описание   |
|---------------|-----------|------------|
| id            | uuid      | PK         |
| username      | string    | unique     |
| password_hash | string    | bcrypt     |
| created_at    | timestamp |            |

## API

### Публичные

```
GET    /api/lectures              — список лекций
GET    /api/lectures/:id          — лекция (включает video_url, notes_url)
GET    /api/lectures/:id/transcript — расшифровка
```

`video_url` и `notes_url` генерируются бекендом через `Storage.GetURL()` — прямая ссылка на файл (локальный путь или presigned S3 URL).

### Админские (JWT)

```
POST   /api/admin/auth/login              — авторизация
POST   /api/admin/lectures                — создать лекцию
PUT    /api/admin/lectures/:id            — обновить
DELETE /api/admin/lectures/:id            — удалить
POST   /api/admin/lectures/:id/transcript — загрузить расшифровку
POST   /api/admin/upload                  — загрузить файл
```

## Файловое хранилище

Абстракция через интерфейс:

```go
type Storage interface {
    Upload(ctx context.Context, key string, reader io.Reader) error
    Delete(ctx context.Context, key string) error
    GetURL(ctx context.Context, key string) (string, error)
}
```

- **LocalStorage**: файлы на диске, URL — путь к статике через nginx
- **S3Storage**: presigned URL с TTL

Структура на диске:

```
data/
├── videos/{lecture_id}.mp4
├── notes/{lecture_id}.docx
└── transcripts/{lecture_id}.json
```

## Авторизация

- JWT-токен (24ч), содержит admin_id, username, exp
- bcrypt для паролей
- Админов создаёт CLI: `philosophy-api create-admin --username admin --password secret`
- Middleware на всех `/api/admin/*`

## Конфигурация

Переменные окружения (12-factor):

```env
PORT=8080
DATABASE_URL=sqlite://data/philosophy.db
STORAGE_TYPE=local
STORAGE_PATH=./data
JWT_SECRET=<random-string>
CORS_ORIGINS=http://localhost:3001
```

## Деплой

- Dockerfile: multi-stage build, финальный образ ~20MB
- Makefile: build, run, migrate, create-admin
- docker-compose: Go API + nginx для статики
- БД: SQLite для старта, PostgreSQL при необходимости

## Тестирование

- Unit-тесты: сервисный слой с мок-хранилищем
- Integration-тесты: хендлеры с in-memory SQLite
- Единый формат ошибок: `{"error": "message", "code": "CODE"}`
- Структурированное логирование через slog
