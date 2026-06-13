# Шаблон слайса фичи

Скопируй эту папку в `src/features/<entity>/`, переименуй упоминания
`_template` и наполни смыслом.

## Чеклист (до open PR)

- [ ] `index.ts` экспортирует только то, что нужно снаружи
- [ ] `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";`
- [ ] Каждая `canXxx` в `permissions.ts` покрыта тестом
- [ ] Каждая Zod-схема имеет минимум 1 success + 1 failure тест
- [ ] Использует `createFormAction` + `parseFormData` + `requireCapability` + `revalidateEntity`
- [ ] Не импортит другие `@/features/*` (запрещено ESLint'ом)
- [ ] Удалён `ui/.gitkeep`, добавлены реальные UI-файлы
- [ ] `npm run lint && npm run test && npm run build` зелёные локально

См. конвенции: `docs/frontend-conventions.md`.
См. дизайн: `docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`.
