"use client";
// src/features/documents/ui/document-edit-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import { AstMergeView, type MergeViewLabels } from "@/components/ast-merge";
import { Form, FormField, IdempotencyField, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateDocumentBlocks } from "../actions";
import type { Document, DocumentBlocksSaveResult } from "../types";

const initial: ActionResult<DocumentBlocksSaveResult> = {
  success: true,
  data: { kind: "saved", document: null },
};

interface Props {
  document: Document;
}

export function DocumentEditForm({ document }: Props) {
  const t = useT("documents");
  const tErrors = useT("errors");

  // base — версия, от которой произведены текущие правки (обновляется после merge)
  const [baseBlocks, setBaseBlocks] = useState<AstBlock[]>(document.blocks ?? []);
  const [baseVersion, setBaseVersion] = useState<number | undefined>(
    document.version,
  );
  // источник defaultValue редактора + ключ для перемонтирования при загрузке merged
  const [editorSeed, setEditorSeed] = useState<AstBlock[]>(document.blocks ?? []);
  const [editorKey, setEditorKey] = useState(0);
  // текущее содержимое редактора (mine)
  const [blocks, setBlocks] = useState<AstBlock[]>(document.blocks ?? []);

  const [conflict, setConflict] = useState<
    { blocks: AstBlock[]; version: number } | null
  >(null);
  const [gone, setGone] = useState(false);

  const [state, action] = useActionState(updateDocumentBlocks, initial);

  // Реакция на свежий результат action — паттерн «adjust state during render»
  // (react.dev) вместо useEffect: правило react-hooks/set-state-in-effect
  // запрещает синхронный setState в эффектах (см. tags/ui/tag-admin-row.tsx).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) {
      if (state.data.kind === "conflict") {
        setConflict(state.data.theirs);
      } else if (state.data.kind === "gone") {
        setGone(true);
      } else if (state.data.document) {
        // успешное сохранение — синхронизируем base со свежей серверной версией
        setBaseVersion(state.data.document.version);
        setBaseBlocks(state.data.document.blocks ?? []);
      }
    }
  }

  const mergeLabels: MergeViewLabels = {
    title: t("merge.title"),
    intro: t("merge.intro"),
    badgeServerChanged: t("merge.badgeServerChanged"),
    badgeYourEdit: t("merge.badgeYourEdit"),
    badgeAddedByYou: t("merge.badgeAddedByYou"),
    badgeAddedOnServer: t("merge.badgeAddedOnServer"),
    badgeRemovedByYou: t("merge.badgeRemovedByYou"),
    badgeRemovedOnServer: t("merge.badgeRemovedOnServer"),
    conflictHeading: t("merge.conflictHeading"),
    optionServer: t("merge.optionServer"),
    optionMine: t("merge.optionMine"),
    acceptDeletion: t("merge.acceptDeletion"),
    contentChanged: t("merge.contentChanged"),
    unchangedLabel: t("merge.unchangedLabel"),
    showUnchanged: t("merge.showUnchanged"),
    hideUnchanged: t("merge.hideUnchanged"),
    applyButton: t("merge.applyButton"),
    cancelButton: t("merge.cancelButton"),
    takeServerButton: t("merge.takeServerButton"),
  };

  // «Отбросить мои правки, взять серверную»: серверная версия конфликта
  // становится и содержимым редактора, и новой base — далее обычное сохранение.
  function takeServer() {
    if (!conflict) return;
    applyMerge(conflict.blocks);
  }

  function applyMerge(merged: AstBlock[]) {
    setEditorSeed(merged);
    setBlocks(merged);
    setEditorKey((k) => k + 1); // перемонтировать редактор с новым defaultValue
    if (conflict) {
      setBaseBlocks(conflict.blocks);
      setBaseVersion(conflict.version);
    }
    setConflict(null);
  }

  if (gone) {
    return <p className="text-sm text-red-600">{t("merge.goneMessage")}</p>;
  }

  return (
    <>
      <Form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={document.id ?? ""} />
        <input type="hidden" name="version" value={baseVersion ?? ""} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <FormField name="blocks" label={t("contentLabel")}>
          <LazyAstEditor
            key={editorKey}
            defaultValue={editorSeed}
            entityContext="document"
            onChange={(next: AstBlock[]) => {
              setBlocks(next);
            }}
          />
        </FormField>

        {state.success &&
          state.data.kind === "saved" &&
          state.data.document && (
            <p className="text-sm text-(--color-fg-muted)">{t("savedMessage")}</p>
          )}
        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: t("editForbiddenAction") })}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <div>
          <SubmitButton>{t("saveContentButton")}</SubmitButton>
        </div>
      </Form>

      {conflict && (
        <AstMergeView
          base={baseBlocks}
          mine={blocks}
          theirs={conflict.blocks}
          labels={mergeLabels}
          onApply={applyMerge}
          onCancel={() => {
            setConflict(null);
          }}
          onTakeServer={takeServer}
        />
      )}
    </>
  );
}
