// src/app/_offline/offline-read.ts
// Pure save-flow (read): собрать офлайн-снимок сущности через её дескриптор.
// Резолвер инжектируется (тестируемо); реальный resolveDescriptor подставляет
// server-экшен. Снимок entity-agnostic (unknown) — его форму знает дескриптор/view.
import type { DescriptorResolver } from "@/services/offline/repository";

export interface OfflineBundleData {
  snapshot: unknown;
  imageKeys: string[];
}

export async function assembleBundle(
  resolve: DescriptorResolver,
  entity: string,
  id: string,
): Promise<OfflineBundleData | null> {
  const descriptor = resolve(entity);
  if (!descriptor) return null;
  const snapshot = await descriptor.assemble(id);
  if (snapshot === null) return null;
  return { snapshot, imageKeys: descriptor.extractImageKeys(snapshot) };
}
