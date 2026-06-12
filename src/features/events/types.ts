// src/features/events/types.ts
import type { components } from "@/api/schema";

/**
 * Календарное событие (admin CRUD). Имя CalendarEvent — чтобы не
 * конфликтовать с глобальным DOM-типом Event.
 */
export type CalendarEvent = components["schemas"]["event.Event"];

/** Одно вхождение события в GET /api/calendar (развёрнутые повторения). */
export type EventOccurrence = components["schemas"]["event.Occurrence"];

/** Мета ревизии (элемент списка GET /api/admin/events/{id}/revisions). */
export type EventRevisionMeta = components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия со снапшотом blocks. */
export type EventRevision = components["schemas"]["revision.Revision"];
