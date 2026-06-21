"use client";
// src/features/canvas/ui/editor-toolbar.tsx
import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { EditorCommand } from "../editor";

interface Props {
  dispatch: (c: EditorCommand) => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  gridEnabled: boolean;
  saving: boolean;
  showJson: boolean;
  hasSelection: boolean;
  onAddText: () => void;
  onAddShape: (kind: "rect" | "ellipse" | "diamond") => void;
  onAddEntityRef: () => void;
  onSave: () => void;
  onToggleJson: () => void;
  onBack: () => void;
}

/** Тулбар редактора: создание узлов, удаление, история, сетка, сохранение. */
export function EditorToolbar({
  dispatch, canUndo, canRedo, dirty, gridEnabled, saving, showJson, hasSelection,
  onAddText, onAddShape, onAddEntityRef, onSave, onToggleJson, onBack,
}: Props) {
  const t = useT("canvas");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-(--color-border) p-2">
      <Button type="button" compact variant="ghost" onClick={onBack}>{t("toolbar.back")}</Button>
      <span className="mx-1 h-5 w-px bg-(--color-border)" />

      <Button type="button" compact onClick={onAddText}>{t("toolbar.addText")}</Button>
      <Button type="button" compact onClick={() => { onAddShape("rect"); }}>{t("toolbar.addRect")}</Button>
      <Button type="button" compact onClick={() => { onAddShape("ellipse"); }}>{t("toolbar.addEllipse")}</Button>
      <Button type="button" compact onClick={() => { onAddShape("diamond"); }}>{t("toolbar.addDiamond")}</Button>
      <Button type="button" compact onClick={onAddEntityRef}>{t("toolbar.addLink")}</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" compact variant="danger" disabled={!hasSelection} onClick={() => { dispatch({ type: "deleteSelection" }); }}>
        {t("toolbar.deleteSelected")}
      </Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" compact variant="ghost" disabled={!canUndo} onClick={() => { dispatch({ type: "undo" }); }} aria-label={t("toolbar.undoAriaLabel")}>↶</Button>
      <Button type="button" compact variant="ghost" disabled={!canRedo} onClick={() => { dispatch({ type: "redo" }); }} aria-label={t("toolbar.redoAriaLabel")}>↷</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" compact variant={gridEnabled ? "primary" : "ghost"} onClick={() => { dispatch({ type: "toggleGrid" }); }}>
        {t("toolbar.grid")}
      </Button>
      <Button type="button" compact variant="ghost" onClick={onToggleJson}>
        {showJson ? t("toolbar.showCanvas") : t("toolbar.showJson")}
      </Button>

      <span className="ml-auto flex items-center gap-2">
        {dirty && <span className="text-xs text-(--color-fg-muted)">{t("toolbar.unsavedChanges")}</span>}
        <Button type="button" compact variant="primary" disabled={saving || !dirty} onClick={onSave}>
          {saving ? t("toolbar.saving") : t("toolbar.save")}
        </Button>
      </span>
    </div>
  );
}
