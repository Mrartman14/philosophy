// src/services/offline/contract/descriptor.ts
// Изоморфный контракт «плага» сущности для offline foundation.
// Тип-only: фичи реализуют дескриптор, app/_offline собирает реестр (F4).
// Ядро (repository/sync) зависит ТОЛЬКО от этого типа, не от фич.
import type { ActionResult } from "@/utils/create-action";

/** Результат лёгкой manifest-пробы свежести (ETag/version, If-None-Match). */
export type ManifestProbe =
  | { status: "fresh" }
  | { status: "stale"; freshnessToken: string }
  | { status: "gone" }
  | { status: "skip" };

/** Результат legacy-пробы маркера (напр. updated_at) для бандлов без freshnessToken. */
export type MarkerProbe =
  | { status: "present"; marker: string }
  | { status: "gone" }
  | { status: "skip" };

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

  // ── СВЕЖЕСТЬ (опционально; lectures сейчас, documents позже) ──
  /**
   * server-only пробы свежести сохранённой копии. Нет capability → ревалидация
   * для сущности no-op (кнопка живёт в режиме saved/not-saved).
   */
  freshness?: {
    /** Дешёвая manifest-проба по If-None-Match (типизированный openapi-путь внутри). */
    probeManifest: (id: string, token: string | undefined) => Promise<ManifestProbe>;
    /** legacy-fallback для бандлов без freshnessToken; необязателен для новых сущностей. */
    probeMarker?: (id: string) => Promise<MarkerProbe>;
  };
}
