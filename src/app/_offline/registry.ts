// src/app/_offline/registry.ts
// Composition root offline foundation: единственный легальный по ESLint канал
// «фича → foundation» (D12). Слайсы L (lectures) и A (annotations) добавят сюда
// свои дескрипторы; ядро (repository/route handler/save action) получает только
// resolveDescriptor и остаётся entity-agnostic.
import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

export const OFFLINE_REGISTRY: Record<string, OfflineDescriptor> = {
  // Слайс L добавит: [Tags.LECTURES]: lectureDescriptor
  // Слайс A добавит: [Tags.ANNOTATIONS]: annotationDescriptor
};

export const resolveDescriptor: DescriptorResolver = (entity) =>
  OFFLINE_REGISTRY[entity];
