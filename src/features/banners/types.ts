// src/features/banners/types.ts
import type { components } from "@/api/schema";

/** Информационный баннер (admin CRUD + публичный показ активных). */
export type Banner = components["schemas"]["banner.Banner"];

/** Аудитория показа: all | authenticated | admin. */
export type BannerTargetAudience = components["schemas"]["banner.TargetAudience"];

/** Семантический вариант оформления: info|success|warning|danger|brand|neutral. */
export type BannerVariant = components["schemas"]["banner.Variant"];

/** Мета ревизии (элемент списка GET /api/admin/banners/{id}/revisions). */
export type BannerRevisionMeta = components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия со снапшотом blocks. */
export type BannerRevision = components["schemas"]["revision.Revision"];
