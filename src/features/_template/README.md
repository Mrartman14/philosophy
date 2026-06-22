# Шаблон слайса фичи

Скопируй эту папку в `src/features/<entity>/`, переименуй упоминания
`_template` и наполни смыслом.

## Чеклист (до open PR)

- [ ] `index.ts` экспортирует только то, что нужно снаружи
- [ ] client-видимые экспорты (для `"use client"`/офлайн) — в `client.ts`, НЕ в `index.ts` (server-only/cross-feature не реэкспортить — форсит Guardrail 4)
- [ ] `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";`
- [ ] Каждая `canXxx` в `permissions.ts` покрыта тестом
- [ ] Каждая Zod-схема имеет минимум 1 success + 1 failure тест
- [ ] Использует `createFormAction` + `parseFormData` + `requireCapability` + `revalidateEntity`
- [ ] Формы биндятся к схеме: `const { Field, f, errors } = createTypedForm<XCreateFormInput>()` (тип — `z.input`, не `z.infer`; `import type` из `schemas.ts`). `name` — через `Field`/`f`, ошибки — через `errors(state)`. Поля вне схемы (напр. контекстный `lecture_id`) — raw-строкой `name="…"`.
- [ ] Не импортит другие `@/features/*` (запрещено ESLint'ом)
- [ ] Удалён `ui/.gitkeep`, добавлены реальные UI-файлы
- [ ] Удалён scaffolded `client.ts`, если в слайсе нет `"use client"`-кода или офлайн-потребителей (пустой re-export только засоряет дерево)
- [ ] `pnpm lint && pnpm test && pnpm build` зелёные локально

См. конвенции: `docs/frontend-conventions.md`.
См. дизайн: `docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`.
