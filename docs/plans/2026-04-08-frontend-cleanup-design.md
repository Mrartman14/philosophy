# Комплексная чистка фронтенда — Дизайн

**Дата**: 2026-04-08
**Статус**: утверждён
**Подход**: поэтапный рефакторинг (каждый этап — отдельный коммит, проект работает после каждого шага)

## Этап 1: CSS-архитектура и темы

**Проблема**: globals.css содержит два конфликтующих `@theme` блока и два `:root` блока. Тема rebus фактически не применяется — второй `@theme` (kantian) перезаписывает первый.

**Решение**:

- globals.css — один `@theme` блок (читает из CSS-переменных), глобальные стили, утилитарные классы
- Переключение тем через CSS-класс на `<html>`: без класса = rebus, `class="theme-kantian"` = kantian
- Файлы тем в `src/styles/themes/`:
  - `rebus.css` — `:root { ... }` + `@media (prefers-color-scheme: dark) { :root { ... } }`
  - `kantian.css` — `.theme-kantian { ... }` + `@media (prefers-color-scheme: dark) { .theme-kantian { ... } }`
- globals.css импортирует оба файла
- Удалить: дублирующие блоки, переменную `--test`, дублирование `color-scheme: light dark`

## Этап 2: Миграция стилей на Tailwind

**Проблема**: 6 компонентов используют отдельные .css файлы, остальные — Tailwind inline. Нет единого подхода.

**Решение**:

| Файл | Действие |
|------|----------|
| `app-header.css` | Перенести `::before` в Tailwind `before:` модификаторы, удалить файл |
| `aside-menu.css` | Перенести в Tailwind inline, удалить файл |
| `scroll-progress-bar.css` | Перенести в Tailwind inline, удалить файл |
| `tractate.css` | Перенести в Tailwind inline, удалить файл |
| `compact-grid.css` | Удалить вместе с компонентом (не используется) |
| `firework.css` | Почистить от мёртвого кода и vendor-префиксов, оставить как .css (объём анимаций не переносится в Tailwind разумно) |

## Этап 3: Компоненты — извлечение и очистка

**Извлечь переиспользуемые компоненты**:
- `LectureGrid` — единый компонент для сетки карточек (дублируется в dashboard и lecture-list)
- `SectionHeader` — однотипные заголовки секций из lectures-dashboard.tsx

**Починить динамические классы**:
- lecture-list.tsx: заменить `` pl-${Math.min(depth * 4, 12)} `` на `style={{ paddingLeft: depth * 16 }}`

**Удалить мёртвый код**:
- `CompactGrid` компонент + compact-grid.css
- `NewLecturesProvider` (пустая async-функция)
- Закомментированные блоки: Image в app-header, Mention/philosopher timeline в lecture layout, loading skeleton в docx-viewer
- Мёртвый код PWA install prompt в sw-provider (оставить сам провайдер)

## Этап 4: Производительность

**LectureServiceProvider**:
- Создать `Map<string, Lecture>` через `useMemo`
- Заменить `.map((id) => lectures.find(...))` на O(1) lookup
- Обернуть производные данные (favLectures, viewedLectures) в `useMemo`

**AsideMenu**:
- Извлечь логику intersection observer в хук `useActiveSection`
- Кэшировать ссылки на DOM-элементы вместо повторных `document.getElementById`

## Что не трогаем

- Структуру папок компонентов (app, shared, lecture, providers) — логичная
- Архитектуру state management (Context, IndexedDB, useState) — покрывает разные задачи
- Marquee requestAnimationFrame — стандартный паттерн для плавной анимации
- Типы и пропсы компонентов — мелкие правки не стоят отдельного этапа
