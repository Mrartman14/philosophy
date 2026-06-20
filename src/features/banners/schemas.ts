// src/features/banners/schemas.ts
import "server-only";
import { z } from "zod";

import { BANNER_TARGET_AUDIENCES } from "@/api/enums";
import type { NamespaceT } from "@/i18n";
import { blocksJsonField } from "@/utils/blocks-json";
import { toRfc3339 } from "@/utils/datetime-form";

/** Регекс бекенда (internal/banner/service.go hexColorRe) — повторяем 1:1. */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ValidationT = NamespaceT<"validation">;

function makeBannerFieldsSchema(t: ValidationT) {
  return z.object({
    background_color: z
      .string()
      .trim()
      .regex(HEX_COLOR_RE, t("banners.colorFormat")),
    target_audience: z.enum(BANNER_TARGET_AUDIENCES, {
      message: t("banners.audienceRequired"),
    }),
    // Hidden input в формах всегда отправляет "true" | "false" — omitted-чекбокс
    // в FormData неотличим от «не менять» при частичном PUT.
    dismissible: z.enum(["true", "false"], {
      message: t("banners.dismissibleInvalid"),
    }),
    start_at: z.string().trim().min(1, t("banners.startAtRequired")),
    end_at: z.string().trim().optional(),
    event_id: z.string().trim().optional(),
  });
}

type BannerFieldsRaw = z.infer<ReturnType<typeof makeBannerFieldsSchema>>;

/**
 * Общая нормализованная форма create/update-полей. Явный `| undefined` —
 * требование exactOptionalPropertyTypes: transform-выход Zod типизирует
 * end_at/event_id как `string | undefined` (обязательные ключи).
 */
interface BannerInputCommon {
  background_color: string;
  target_audience: "all" | "authenticated" | "admin";
  dismissible: boolean;
  start_at: string;
  end_at?: string | undefined;
  event_id?: string | undefined;
}

function normalizeFields(raw: BannerFieldsRaw) {
  return {
    background_color: raw.background_color,
    target_audience: raw.target_audience,
    dismissible: raw.dismissible === "true",
    start_at: toRfc3339(raw.start_at),
    end_at: raw.end_at ? toRfc3339(raw.end_at) : undefined,
    // Пустую строку сохраняем: в Update она означает «отвязать событие»
    // (repo.Update бекенда: "" → SQL NULL). Create отбрасывает её в transform.
    event_id: raw.event_id ?? "",
  };
}

function makeValidateFields(t: ValidationT) {
  return function validateFields(
    v: BannerInputCommon,
    ctx: z.RefinementCtx,
  ): void {
    if (Number.isNaN(Date.parse(v.start_at))) {
      ctx.addIssue({
        code: "custom",
        path: ["start_at"],
        message: t("banners.startAtInvalid"),
      });
    }
    if (v.end_at !== undefined && Number.isNaN(Date.parse(v.end_at))) {
      ctx.addIssue({
        code: "custom",
        path: ["end_at"],
        message: t("banners.endAtInvalid"),
      });
    }
    // Бек требует СТРОГО end_at > start_at (!parsed.After(startAt) → 422).
    // Оба значения в одном формате (RFC3339 Z) — лексикографическое сравнение
    // корректно.
    if (v.end_at !== undefined && v.end_at <= v.start_at) {
      ctx.addIssue({
        code: "custom",
        path: ["end_at"],
        message: t("banners.endAtBeforeStart"),
      });
    }
    if (v.event_id && !UUID_RE.test(v.event_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["event_id"],
        message: t("banners.eventIdUuid"),
      });
    }
  };
}

export function makeBannerCreateSchema(t: ValidationT) {
  return makeBannerFieldsSchema(t)
    .transform((raw) => {
      const v = normalizeFields(raw);
      // В Create пустая привязка просто не отправляется.
      return { ...v, event_id: v.event_id || undefined };
    })
    .superRefine(makeValidateFields(t));
}

export function makeBannerUpdateSchema(t: ValidationT) {
  const BlocksJsonSchema = blocksJsonField({
    allowEmpty: true,
    messages: {
      invalidJson: t("banners.blocksInvalidJson"),
      notArray: t("common.blocksNotArray"),
    },
  });

  return makeBannerFieldsSchema(t)
    .extend({
      id: z.uuid(t("banners.invalidId")),
      blocks: BlocksJsonSchema,
    })
    .transform((raw) => ({
      ...normalizeFields(raw),
      id: raw.id,
      blocks: raw.blocks,
    }))
    .superRefine(makeValidateFields(t));
}

export const BannerIdSchema = z.object({
  id: z.uuid("invalid-banner-id"),
});

// Legacy static schemas — kept for existing tests that don't use the factory.
// The actions pass a real `t` via makeBannerCreateSchema / makeBannerUpdateSchema.
const _identityT = ((key: string) => key) as unknown as ValidationT;
export const BannerCreateSchema = makeBannerCreateSchema(_identityT);
export const BannerUpdateSchema = makeBannerUpdateSchema(_identityT);

export type BannerCreateInput = z.infer<ReturnType<typeof makeBannerCreateSchema>>;
export type BannerUpdateInput = z.infer<ReturnType<typeof makeBannerUpdateSchema>>;
export type BannerIdInput = z.infer<typeof BannerIdSchema>;
