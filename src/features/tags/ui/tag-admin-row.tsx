// src/features/tags/ui/tag-admin-row.tsx
"use client";
import { useActionState, useState } from "react";
import { Button, Form, FormField, SubmitButton, TextInput } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updateTag } from "../actions";
import type { Tag } from "../types";
import { TagDeleteButton } from "./tag-delete-button";

const initial: ActionResult<Tag | null> = { success: true, data: null };

interface Props {
  tag: Tag;
  canEdit: boolean;
  canDelete: boolean;
}

export function TagAdminRow({ tag, canEdit, canDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateTag, initial);
  const fieldErrors: Record<string, string> =
    !state.success && state.code === "validation"
      ? state.fieldErrors
      : {};

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
            <Button variant="ghost" onClick={() => { setEditing((v) => !v); }}>
              {editing ? "Отмена" : "Переименовать"}
            </Button>
          )}
          {canDelete && hasId && (
            <TagDeleteButton id={tag.id!} name={tag.name} />
          )}
        </div>
      </div>

      {editing && hasId && (
        <Form action={action} errors={fieldErrors} className="flex items-end gap-2">
          <input type="hidden" name="id" value={tag.id} />
          <FormField name="name" label="Новое имя" className="flex-1">
            <TextInput name="name" required maxLength={100} defaultValue={tag.name} />
          </FormField>
          <SubmitButton>Сохранить</SubmitButton>
        </Form>
      )}
      {editing && !state.success && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на переименование тега.</p>
      )}
      {editing && !state.success && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </li>
  );
}
