// src/features/_template/index.ts
// Public API слайса.
// Сюда экспортируется ТОЛЬКО то, что нужно снаружи (страницам в app/, root layout).
// types.ts, schemas.ts, model/* по умолчанию приватные — экспортируй явно при необходимости.

// Раскомментируй и наполни реальными именами после реализации:
// export { getEntities, getEntityById } from "./api";
// export { createEntity, updateEntity, deleteEntity } from "./actions";
// export { canCreateEntity, canDeleteEntity } from "./permissions";
// export { EntityList, EntityCreateForm } from "./ui/entity-list"; // и т. д.

// Пустой re-export нужен только чтобы файл оставался валидным TS-модулем,
// пока не добавлен ни один реальный экспорт. Удали при появлении первого
// экспорта выше.
export {};
