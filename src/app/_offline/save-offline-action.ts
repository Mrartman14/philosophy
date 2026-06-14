// src/app/_offline/save-offline-action.ts
"use server";

import "server-only";

import { createAction } from "@/utils/create-action";

import { assembleBundle, type OfflineBundleData } from "./offline-read";
import { resolveDescriptor } from "./registry";

/** server-only: собрать офлайн-снимок сущности (RBAC/доступ — внутри descriptor.assemble). */
export const assembleOfflineBundle = createAction(
  (input: { entity: string; id: string }): Promise<OfflineBundleData | null> =>
    assembleBundle(resolveDescriptor, input.entity, input.id),
);
