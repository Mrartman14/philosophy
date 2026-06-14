// src/services/offline/contract/descriptor.ts
// Изоморфный контракт «плага» сущности для offline foundation.
// Тип-only: фичи реализуют дескриптор, app/_offline собирает реестр (F4).
// Ядро (repository/sync) зависит ТОЛЬКО от этого типа, не от фич.
import type { ActionResult } from "@/utils/create-action";

export interface OfflineDescriptor<TSnapshot = unknown, TWritePayload = unknown> {
  /**
   * Стабильный ключ сущности. ОБЯЗАН быть значением из `Tags` (@/api/tags),
   * напр. `Tags.LECTURES` === "lectures", `Tags.ANNOTATIONS` === "annotations"
   * (мн. ч.!) — НЕ имя сущности в ед. числе. По нему резолвится дескриптор и
   * строится `POST /api/offline/{entity}`; рассинхрон молча вернёт null.
   */
  entity: string;
  /** Path-сегмент для ключей IDB / SW-match (потребляется в F1/слайсах; в F3 не читается). Напр. "lectures". */
  pathSegment: string;

  // ── ЧТЕНИЕ ──
  /** server-only: собрать офлайн-снимок (фронт-оркестрация сейчас, бэк-bundle потом). null = нет/нет доступа. */
  assemble: (id: string) => Promise<TSnapshot | null>;
  /** Извлечь sha256-ключи всех картинок снимка (для докачки в Cache Storage). */
  extractImageKeys: (snapshot: TSnapshot) => string[];

  // ── ЗАПИСЬ (опционально; сейчас только annotation) ──
  /** server-only: создать сущность из payload (RBAC + форвард в API + Idempotency-Key). */
  write?: (
    payload: TWritePayload,
    idempotencyKey: string,
  ) => Promise<ActionResult<{ id: string }>>;
}
