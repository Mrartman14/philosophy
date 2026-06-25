"use client";
import { useActionState, useCallback, useState } from "react";

import { AttachTargetPicker } from "@/components/attachments";
import {
  createTypedForm,
  Form,
  FormFeedback,
  IconButton,
  IdempotencyField,
  Inline,
  Select,
  Stack,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import { useActionRedirect } from "@/hooks/use-action-redirect";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createLecture, searchDocumentsForAttach } from "../actions";
import type { LectureCreateFormInput } from "../schemas";
import type { Lecture } from "../types";

const initial = initialActionState<Lecture | null>(null);

const { Field, errors } = createTypedForm<LectureCreateFormInput>();

interface SelectedDoc {
  id: string;
  label: string;
}

export function LectureCreateForm({ canAttach = false }: { canAttach?: boolean }) {
  const tL = useT("lectures");
  const [state, action] = useActionState(createLecture, initial);
  const [docs, setDocs] = useState<SelectedDoc[]>([]);

  // При выборе документов ведём на карточку лекции (там и управление вложениями,
  // и рендер), иначе — на редактирование.
  useActionRedirect(state, (data) =>
    docs.length > 0
      ? `/admin/lectures/${data.id}`
      : `/admin/lectures/${data.id}/edit`,
  );

  const fetcher = useCallback(
    async (q: string, offset: number, limit: number) => {
      const r = await searchDocumentsForAttach({ q, offset, limit });
      return r.success ? r.data : { data: [], total: null };
    },
    [],
  );

  const addDoc = useCallback((id: string, label: string) => {
    setDocs((prev) => (prev.some((d) => d.id === id) ? prev : [...prev, { id, label }]));
  }, []);

  const removeDoc = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        <IdempotencyField result={state} />
        <Field name="title" label={tL("titleLabel")} required>
          <TextInput name="title" aria-required maxLength={200} />
        </Field>

        <Field name="date" label={tL("dateLabel")} required description={tL("dateDescription")}>
          <TextInput name="date" aria-required placeholder="2026-04-27" />
        </Field>

        <Field name="description" label={tL("descriptionLabel")}>
          <Textarea name="description" rows={6} maxLength={5000} />
        </Field>

        <Field name="visibility" label={tL("visibilityLabel")}>
          <Select
            name="visibility"
            defaultValue="private"
            options={[
              { value: "private", label: tL("visibilityPrivate") },
              { value: "public", label: tL("visibilityPublic") },
            ]}
          />
        </Field>

        {canAttach && (
          <Stack>
            <span className="text-sm font-medium">{tL("attachDocsLabel")}</span>
            <span className="text-xs text-(--color-fg-muted)">{tL("attachDocsHint")}</span>
            <AttachTargetPicker
              fetcher={fetcher}
              onSelect={addDoc}
              placeholder={tL("searchDocumentPlaceholder")}
            />
            {docs.length > 0 && (
              <Stack>
                {docs.map((d) => (
                  <Inline key={d.id} className="items-center justify-between">
                    <span className="truncate text-sm">{d.label}</span>
                    <IconButton
                      tone="danger"
                      compact
                      aria-label={tL("attachDocsRemove", { label: d.label })}
                      onClick={() => { removeDoc(d.id); }}
                    >
                      <span className="text-sm">✕</span>
                    </IconButton>
                  </Inline>
                ))}
              </Stack>
            )}
            <input
              type="hidden"
              name="attach_document_ids"
              value={JSON.stringify(docs.map((d) => d.id))}
              readOnly
            />
          </Stack>
        )}

        <FormFeedback result={state} forbiddenAction={tL("createAction")} />

        <div>
          <SubmitButton>{tL("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
