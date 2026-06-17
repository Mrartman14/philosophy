// src/components/ui/form-feedback.tsx
import { actionErrorMessage } from "@/utils/action-message";
import type { ActionResult } from "@/utils/create-action";

interface Props<T> {
  result: ActionResult<T>;
  /** The action name for the forbidden message, e.g. "создание лекции". */
  forbiddenAction: string;
  /** Text to show on success (if provided). */
  successText?: string;
}

/**
 * Renders the feedback paragraph below a form.
 * - success + successText → green status paragraph
 * - forbidden → red alert paragraph with branded text
 * - validation + _form → red alert paragraph with _form message
 * - generic error → red alert paragraph with server error
 * - validation without _form → renders nothing (field errors are handled by FormField)
 */
export function FormFeedback<T>({ result, forbiddenAction, successText }: Props<T>) {
  if (result.success) {
    if (successText) {
      return <p role="status" className="text-sm text-(--color-success)">{successText}</p>;
    }
    return null;
  }

  if (result.code === "forbidden") {
    return (
      <p role="alert" className="text-sm text-(--color-danger)">
        {actionErrorMessage(result, forbiddenAction)}
      </p>
    );
  }

  if (result.code === "validation") {
    const formError = result.fieldErrors._form;
    if (formError) {
      return (
        <p role="alert" className="text-sm text-(--color-danger)">
          {formError}
        </p>
      );
    }
    return null;
  }

  return (
    <p role="alert" className="text-sm text-(--color-danger)">
      {result.error}
    </p>
  );
}
