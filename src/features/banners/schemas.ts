// src/features/banners/schemas.ts
import "server-only";
import { z } from "zod";

import { BANNER_TARGET_AUDIENCES } from "@/api/enums";

/** Регекс бекенда (internal/banner/service.go hexColorRe) — повторяем 1:1. */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * datetime-local ("YYYY-MM-DDTHH:mm[:ss]") → RFC3339 с суффиксом Z.
 * Бек требует RFC3339 для start_at/end_at (internal/banner/service.go).
 * Введённое время трактуется как UTC — осознанное упрощение MVP (как в
 * слайсе events); формы подписаны «(UTC)».
 */
function toRfc3339(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}Z`;
  return value;
}

const BannerFieldsSchema = z.object({
  background_color: z
    .string()
    .trim()
    .regex(HEX_COLOR_RE, "Цвет — hex вида #RGB или #RRGGBB"),
  target_audience: z.enum(BANNER_TARGET_AUDIENCES, {
    message: "Выберите аудиторию",
  }),
  // Hidden input в формах всегда отправляет "true" | "false" — omitted-чекбокс
  // в FormData неотличим от «не менять» при частичном PUT.
  dismissible: z.enum(["true", "false"], {
    message: "Некорректное значение «можно скрыть»",
  }),
  start_at: z.string().trim().min(1, "Укажите начало показа"),
  end_at: z.string().trim().optional(),
  event_id: z.string().trim().optional(),
});

type BannerFieldsRaw = z.infer<typeof BannerFieldsSchema>;

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

function validateFields(v: BannerInputCommon, ctx: z.RefinementCtx): void {
  if (Number.isNaN(Date.parse(v.start_at))) {
    ctx.addIssue({
      code: "custom",
      path: ["start_at"],
      message: "Укажите дату и время начала показа",
    });
  }
  if (v.end_at !== undefined && Number.isNaN(Date.parse(v.end_at))) {
    ctx.addIssue({
      code: "custom",
      path: ["end_at"],
      message: "Укажите дату и время окончания показа",
    });
  }
  // Бек требует СТРОГО end_at > start_at (!parsed.After(startAt) → 422).
  // Оба значения в одном формате (RFC3339 Z) — лексикографическое сравнение
  // корректно.
  if (v.end_at !== undefined && v.end_at <= v.start_at) {
    ctx.addIssue({
      code: "custom",
      path: ["end_at"],
      message: "Окончание показа должно быть позже начала",
    });
  }
  if (v.event_id && !UUID_RE.test(v.event_id)) {
    ctx.addIssue({
      code: "custom",
      path: ["event_id"],
      message: "id события — UUID",
    });
  }
}

export const BannerCreateSchema = BannerFieldsSchema.transform((raw) => {
  const v = normalizeFields(raw);
  // В Create пустая привязка просто не отправляется.
  return { ...v, event_id: v.event_id || undefined };
}).superRefine(validateFields);

const BlocksJsonSchema = z
  .string()
  .min(1, "Тело не может быть пустым")
  .transform((s, ctx) => {
    try {
      const parsed: unknown = JSON.parse(s);
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: "custom",
          message: "Тело должно быть массивом блоков",
        });
        return z.NEVER;
      }
      return parsed as unknown[];
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Битый JSON в теле формы",
      });
      return z.NEVER;
    }
  });

export const BannerUpdateSchema = BannerFieldsSchema.extend({
  id: z.uuid("Некорректный id баннера"),
  blocks: BlocksJsonSchema,
})
  .transform((raw) => ({
    ...normalizeFields(raw),
    id: raw.id,
    blocks: raw.blocks,
  }))
  .superRefine(validateFields);

export const BannerIdSchema = z.object({
  id: z.uuid("Некорректный id баннера"),
});

export type BannerCreateInput = z.infer<typeof BannerCreateSchema>;
export type BannerUpdateInput = z.infer<typeof BannerUpdateSchema>;
export type BannerIdInput = z.infer<typeof BannerIdSchema>;
