// src/services/offline/repository.ts
// Read-сторона foundation (ports-and-adapters). Один контракт getSnapshot,
// два адаптера: server (свежий assemble) и IndexedDB (сохранённый снимок).
// View зависит от снимка, не от источника. Снимок entity-agnostic (unknown);
// его форму знает дескриптор/view выше.
import type { OfflineDescriptor } from "./contract/descriptor";
import { getSavedBundle } from "./store/saved-bundles";

/** Резолвер дескриптора по ключу сущности (реестр собирает app/_offline в F4). */
export type DescriptorResolver = (
  entity: string,
) => OfflineDescriptor | undefined;

export interface OfflineRepository {
  /**
   * Снимок сущности или null, если его нет/нет доступа.
   * Может reject при сбое источника (сеть в `assemble`, повреждённая IDB);
   * null — ТОЛЬКО для отсутствия, не для ошибки.
   */
  getSnapshot(entity: string, id: string): Promise<unknown>;
}

/** Онлайн-адаптер: собирает снимок свежим через дескриптор сущности. */
export function createServerRepository(
  resolve: DescriptorResolver,
): OfflineRepository {
  return {
    async getSnapshot(entity, id) {
      const descriptor = resolve(entity);
      return descriptor ? await descriptor.assemble(id) : null;
    },
  };
}

/** Офлайн-адаптер: отдаёт ранее сохранённый снимок из saved-bundles. */
export function createIndexedDbRepository(): OfflineRepository {
  return {
    async getSnapshot(entity, id) {
      const record = await getSavedBundle(entity, id);
      // Различаем «нет записи» (null) от записи с любым (в т.ч. falsy) снимком.
      return record ? record.snapshot : null;
    },
  };
}
