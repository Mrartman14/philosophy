// src/features/glossary/index.ts
export { getTerms, getTermById } from "./api";
export type { TermListFilter, TermListResult } from "./api";
export { createTerm, updateTermBlocks, deleteTerm } from "./actions";
export {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
} from "./permissions";
export { GlossaryList } from "./ui/glossary-list";
export { GlossarySearchForm } from "./ui/glossary-search-form";
export { GlossaryDetail } from "./ui/glossary-detail";
export { GlossaryAdminRow } from "./ui/glossary-admin-row";
export { GlossaryCreateForm } from "./ui/glossary-create-form";
export { GlossaryEditForm } from "./ui/glossary-edit-form";
export { GlossaryDeleteButton } from "./ui/glossary-delete-button";
export { GlossaryExportLinks } from "./ui/glossary-export-links";
export { GlossaryRevisions } from "./ui/glossary-revisions";
export type { Term } from "./types";
