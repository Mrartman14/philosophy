# Full Platform Design — Philosophy Frontend

**Date:** 2026-04-08

## Контекст

Бэкенд (philosophy-api) реализует полный набор фич: лекции, транскрипты, файлы, аутентификация с RBAC, комментарии, аннотации, поиск, push-уведомления, админ-API. Фронтенд реализует только лекции, транскрипты и push. Цель — довести фронт до полного покрытия бэкенда.

## Решения

### Архитектура

- Feature-based структура папок (`src/features/*`), без feature flags
- Изоляция фич через git worktrees для параллельной разработки агентами
- Незаконченные фичи не мержатся в main — worktrees заменяют feature flags

### Аутентификация и авторизация

- Полностью серверная. Клиент не знает о JWT, ролях, user_id
- **Server Actions** для login/register/logout — ставят/удаляют httpOnly cookie с JWT
- **`getUser()`** — серверный хелпер, читает cookie, декодирует JWT, возвращает `{ id, role, status } | null`
- **`middleware.ts`** — единственная точка проверки доступа. `/admin/*` требует роль admin
- Сервер решает что рендерить: кнопки "редактировать"/"удалить" рендерятся только если есть право. Клиент получает готовую разметку

### Server Actions

- Все server actions оборачиваются в `createAction` (`src/utils/create-action.ts`)
- Единая точка для обработки ошибок (`{ success, data } | { success, error }`), будущего логирования и валидации

### API-контракт

- Source of truth — Swagger-спека бэкенда (`/swagger/doc.json`)
- `openapi-typescript` для генерации типов (уже есть)
- `openapi-fetch` для типизированного fetch-клиента — пути и методы проверяются на этапе компиляции
- npm-скрипт `generate:api` — стягивает спеку и перегенерирует типы + клиент

## Структура проекта

```
src/
├── middleware.ts                        # защита /admin/* по роли из JWT cookie
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # главная (список лекций)
│   ├── lectures/[id]/page.tsx          # страница лекции
│   ├── login/page.tsx                  # страница логина
│   ├── register/page.tsx               # страница регистрации
│   ├── search/page.tsx                 # страница поиска
│   ├── admin/
│   │   ├── layout.tsx                  # layout с боковым меню, проверка роли
│   │   ├── page.tsx                    # дашборд
│   │   ├── lectures/page.tsx           # CRUD лекций
│   │   ├── lectures/[id]/page.tsx      # редактирование лекции
│   │   └── users/page.tsx              # управление пользователями
│   ├── push/page.tsx
│   └── offline/page.tsx
│
├── features/
│   ├── auth/
│   │   ├── actions.ts                  # server actions: login, register, logout
│   │   ├── login-form.tsx              # client component — форма логина
│   │   └── register-form.tsx           # client component — форма регистрации
│   │
│   ├── lectures/
│   │   ├── api.ts
│   │   ├── lecture-list.tsx
│   │   └── lecture-card.tsx
│   │
│   ├── transcript/
│   │   ├── api.ts
│   │   ├── transcript-panel.tsx
│   │   └── transcript-highlighter.tsx
│   │
│   ├── comments/
│   │   ├── api.ts                      # CRUD комментариев, реакции
│   │   ├── comment-list.tsx            # список с пагинацией
│   │   ├── comment-item.tsx            # один комментарий + вложенные
│   │   ├── comment-form.tsx            # создание/редактирование
│   │   └── reaction-button.tsx         # лайк
│   │
│   ├── annotations/
│   │   ├── api.ts                      # CRUD аннотаций
│   │   ├── annotation-list.tsx         # панель аннотаций к лекции
│   │   ├── annotation-form.tsx         # создание (выбор сегментов)
│   │   └── annotation-highlight.tsx    # подсветка сегментов в транскрипте
│   │
│   ├── search/
│   │   ├── api.ts                      # полнотекстовый поиск
│   │   ├── search-input.tsx            # инпут в хедере
│   │   └── search-results.tsx          # результаты с группировкой по типу
│   │
│   ├── admin/
│   │   ├── lectures/
│   │   │   ├── lecture-editor.tsx       # форма создания/редактирования
│   │   │   ├── lecture-table.tsx        # таблица со всеми лекциями
│   │   │   ├── transcript-editor.tsx   # редактор сегментов
│   │   │   └── file-manager.tsx        # загрузка/удаление файлов
│   │   ├── users/
│   │   │   └── user-table.tsx          # список, смена статуса
│   │   ├── comments/
│   │   │   └── comment-moderation.tsx  # модерация комментариев
│   │   └── push/
│   │       └── push-sender.tsx         # отправка уведомлений
│   │
│   └── player/                         # существующий видеоплеер
│       ├── video-player.tsx
│       ├── player-controls.tsx
│       ├── timeline.tsx
│       └── ...
│
├── components/shared/                  # gradient, skeleton, go-back
├── hooks/                              # общие хуки (useNetworkStatus, etc.)
├── api/
│   ├── client.ts                       # типизированный openapi-fetch клиент
│   └── schema.ts                       # сгенерированные типы
└── utils/
    ├── create-action.ts                # createAction (прямые вызовы) + createFormAction (useActionState)
    └── get-user.ts                     # getUser() — декодирует JWT из cookie, возвращает AuthUser | null
```

## Фичи

### Комментарии

- Плоский список с пагинацией на странице лекции (под видео/транскриптом)
- Анонимные комментарии для неавторизованных
- Для авторизованных — чекбокс "Анонимно"
- Реакции (лайк) — клиентский компонент с optimistic update, server action для персистенции
- Редактирование/удаление своих комментариев — кнопки рендерятся сервером при наличии прав
- Создание через server action с `createAction`, после отправки — `revalidatePath`

### Аннотации

- Привязка к сегментам транскрипта
- Выделение сегментов: клик/shift+клик для диапазона
- После выделения — кнопка "Добавить аннотацию"
- Сегменты с аннотациями визуально подсвечены (маркер сбоку или фоновый цвет)
- Клик по маркеру — показывает аннотации к этим сегментам
- Чекбокс "Приватная" (видна только автору) и "Анонимно"
- К аннотации можно оставить комментарий (бэкенд поддерживает `annotation_id`)
- Все мутации через server actions с `createAction`

### Поиск

- Поисковый инпут в хедере (иконка → раскрывается поле ввода)
- Страница `/search?q=...` с результатами
- Результаты сгруппированы по типу: лекции, транскрипты, комментарии, аннотации
- Каждый результат — ссылка на источник
- Server component, поиск выполняется на сервере
- Поисковая форма — обычный `<form>` с GET-методом

### Админ-панель

- `/admin` — свой layout с боковым меню
- Middleware не пропускает без роли admin
- Все страницы — server components, все мутации — server actions через `createAction`

| Роут | Функционал |
|------|------------|
| `/admin` | Дашборд — кол-во лекций, комментариев, юзеров |
| `/admin/lectures` | Таблица лекций, создание/удаление |
| `/admin/lectures/[id]` | Редактирование: метаданные, файлы, редактор транскрипта (таблица сегментов с inline-редактированием) |
| `/admin/users` | Таблица юзеров, смена статуса (active/suspended/banned) |
| `/admin/comments` | Модерация — список, смена статуса, удаление |
| `/admin/annotations` | Модерация — аналогично комментариям |
| `/admin/push` | Форма отправки push-уведомления |

### Файл-менеджер (в `/admin/lectures/[id]`)

- Список прикреплённых файлов с типом (video/notes/image)
- Загрузка через `<input type="file">` + server action
- Удаление файла
