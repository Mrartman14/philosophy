// src/features/tags/ui/tag-admin-row.tsx
"use client";
import { useActionState, useState } from "react";

import { Button, createTypedForm, Form, FormFeedback, Inline, SubmitButton, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { updateTag } from "../actions";
import type { TagUpdateFormInput } from "../schemas";
import type { Tag } from "../types";

import { TagDeleteButton } from "./tag-delete-button";

const initial = initialActionState<Tag | null>(null);

const { Field, f, errors } = createTypedForm<TagUpdateFormInput>();

interface Props {
  tag: Tag;
  canEdit: boolean;
  canDelete: boolean;
}

export function TagAdminRow({ tag, canEdit, canDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateTag, initial);
  const tTags = useT("tags");

  // После успешного переименования сворачиваем inline-форму.
  // Паттерн «adjust state during render» (react.dev) вместо useEffect:
  // правило react-hooks/set-state-in-effect запрещает setState в эффектах.
  const [prevState, setPrevState] = useState(initial);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success && state.data) setEditing(false);
  }

  const hasId = typeof tag.id === "number";

  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between gap-4">
        <span className="flex-1 truncate">{tag.name}</span>
        <div className="flex items-center gap-2">
          {canEdit && hasId && (
            <Button tone="quiet" onClick={() => { setEditing((v) => !v); }}>
              {editing ? tTags("cancel") : tTags("rename")}
            </Button>
          )}
          {canDelete && typeof tag.id === "number" && (
            <TagDeleteButton id={tag.id} name={tag.name} />
          )}
        </div>
      </div>

      {editing && hasId && (
        <Form action={action} errors={errors(state)}>
          <Inline align="end">
            <input type="hidden" name={f("id")} value={tag.id} />
            <Field name="name" label={tTags("newNameLabel")} className="flex-1" required>
              <TextInput name="name" required maxLength={100} defaultValue={tag.name} />
            </Field>
            <SubmitButton>{tTags("saveButton")}</SubmitButton>
          </Inline>
        </Form>
      )}
      {editing && (
        <FormFeedback result={state} forbiddenAction={tTags("renameTagAction")} />
      )}
    </li>
  );
}
