// src/features/forms/index.ts
// Public API слайса forms.
export type {
  Form,
  FormField,
  FieldOption,
  FieldType,
  SubmissionMode,
  Visibility,
  Submission,
  Answer,
  SubmitResponse,
  FormListItem,
  SubmissionListItem,
  AstBlock,
  FormStats,
  FieldStats,
  OptionStat,
  NumberStats,
  DateStats,
  FieldAnswerItem,
  AnswerValue,
  SubmissionVisibility,
} from "./types";

export {
  canCreateForm,
  canEditForm,
  canPublishForm,
  canDeleteForm,
  canListFormSubmissions,
  canEditSubmission,
  canDeleteSubmission,
  canRetractSubmission,
  canAdminDeleteForm,
  canListAdminForms,
  canViewFormResults,
} from "./permissions";

export {
  getFormById,
  getMyForms,
  getMySubmissions,
  getSubmissionsByForm,
  getSubmissionById,
  getAdminForms,
  getFormStats,
  getFieldAnswers,
} from "./api";
export type { AdminFormListFilter, FormListResult } from "./api";

export { readAnswerValue } from "./answer-read";
export type { ReadValue } from "./answer-read";

export {
  createForm,
  updateForm,
  publishForm,
  deleteForm,
  submitForm,
  editSubmission,
  deleteSubmission,
  retractSubmission,
} from "./actions";

export { FormCreateForm } from "./ui/form-create-form";
export { FormEditForm } from "./ui/form-edit-form";
export { FormPublishButton } from "./ui/form-publish-button";
export { FormDeleteButton } from "./ui/form-delete-button";
export { MyFormsList } from "./ui/my-forms-list";
export { FormAdminRow } from "./ui/form-admin-row";
export { FormDetail } from "./ui/form-detail";
export { FormMeta } from "./ui/form-meta";
export { FormAfterSubmit } from "./ui/form-after-submit";
export { FormFill } from "./ui/form-fill";
export { FormResultsView } from "./ui/form-results-view";
export { FormVisibilityBadges } from "./ui/form-visibility-badges";
export { FieldAnswersColumn } from "./ui/field-answers-column";
export { FormFieldInput } from "./ui/form-field-input";
export { SubmissionDetail } from "./ui/submission-detail";
export { SubmissionEditForm } from "./ui/submission-edit-form";
export { SubmissionActions } from "./ui/submission-actions";
export { SubmissionList } from "./ui/submission-list";
export { MySubmissionsList } from "./ui/my-submissions-list";
