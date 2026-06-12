// src/features/glossary/types.ts
import type { components } from "@/api/schema";

export type Term = components["schemas"]["glossary.Term"];

/** Мета ревизии термина (элемент списка GET /api/glossary/{id}/revisions). */
export type TermRevisionMeta = components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия термина со снапшотом blocks. */
export type TermRevision = components["schemas"]["revision.Revision"];
