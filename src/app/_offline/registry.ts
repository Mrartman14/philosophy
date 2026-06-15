// src/app/_offline/registry.ts
// Composition root offline foundation: единственный легальный по ESLint канал
// «фича → foundation» (D12). Слайсы L (lectures) и A (annotations) добавят сюда
// свои дескрипторы; ядро (repository/route handler/save action) получает только
// resolveDescriptor и остаётся entity-agnostic.
import { Tags } from "@/api/tags";
import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

import { lectureDescriptor } from "./descriptors/lecture-descriptor";

export const OFFLINE_REGISTRY: Record<string, OfflineDescriptor> = {
  // Типизированный дескриптор в generic-реестр через приведение (вариантность
  // extractImageKeys); рантайм-безопасно — assembleBundle всегда пары assemble+
  // extractImageKeys одного дескриптора. Слайс A добавит [Tags.ANNOTATIONS].
  [Tags.LECTURES]: lectureDescriptor as OfflineDescriptor,
};

export const resolveDescriptor: DescriptorResolver = (entity) =>
  OFFLINE_REGISTRY[entity];
