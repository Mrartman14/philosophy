"use client";
// src/features/canvas/ui/editor-toolbar.tsx
import { ChevronIcon } from "@/assets/icons/chevron-icon";
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
  /** Экспорт графа в SVG/PNG. Если не переданы — кнопки экспорта скрыты (напр. в JSON-режиме). */
  onExportSvg?: (() => void) | undefined;
  onExportPng?: (() => void) | undefined;
  /** Есть что экспортировать (граф непустой). */
  canExport?: boolean | undefined;
  /** Текст save-кнопки. По умолчанию `toolbar.save`; в create-режиме — `toolbar.create`. */
  saveLabel?: string | undefined;
  /** Явный override disabled save-кнопки. По умолчанию `saving || !dirty`. */
  saveDisabled?: boolean | undefined;
  /** Скрыть тогл JSON (raw-JSON форма — только update). */
  hideJsonToggle?: boolean | undefined;
}

/** Тулбар редактора: создание узлов, удаление, история, сетка, сохранение. */
export function EditorToolbar({
  dispatch, canUndo, canRedo, dirty, gridEnabled, saving, showJson, hasSelection,
  onAddText, onAddShape, onAddEntityRef, onSave, onToggleJson, onBack,
  saveLabel, saveDisabled, hideJsonToggle,
  onExportSvg, onExportPng, canExport,
}: Props) {
  const t = useT("canvas");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-(--color-border) p-2">
      <Button type="button" compact tone="quiet" onClick={onBack}><ChevronIcon className="rtl-flip rotate-180" />{t("toolbar.back")}</Button>
      <span className="mx-1 h-5 w-px bg-(--color-border)" />

      <Button type="button" compact onClick={onAddText}>{t("toolbar.addText")}</Button>
      <Button type="button" compact onClick={() => { onAddShape("rect"); }}>{t("toolbar.addRect")}</Button>
      <Button type="button" compact onClick={() => { onAddShape("ellipse"); }}>{t("toolbar.addEllipse")}</Button>
      <Button type="button" compact onClick={() => { onAddShape("diamond"); }}>{t("toolbar.addDiamond")}</Button>
      <Button type="button" compact onClick={onAddEntityRef}>{t("toolbar.addLink")}</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" compact tone="danger" disabled={!hasSelection} onClick={() => { dispatch({ type: "deleteSelection" }); }}>
        {t("toolbar.deleteSelected")}
      </Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" compact tone="quiet" disabled={!canUndo} onClick={() => { dispatch({ type: "undo" }); }} aria-label={t("toolbar.undoAriaLabel")}>↶</Button>
      <Button type="button" compact tone="quiet" disabled={!canRedo} onClick={() => { dispatch({ type: "redo" }); }} aria-label={t("toolbar.redoAriaLabel")}>↷</Button>
      <Button type="button" compact tone="quiet" disabled={!dirty} onClick={() => { dispatch({ type: "reset" }); }}>{t("toolbar.reset")}</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" compact tone={gridEnabled ? "primary" : "quiet"} onClick={() => { dispatch({ type: "toggleGrid" }); }}>
        {t("toolbar.grid")}
      </Button>
      {!hideJsonToggle && (
        <Button type="button" compact tone="quiet" onClick={onToggleJson}>
          {showJson ? t("toolbar.showCanvas") : t("toolbar.showJson")}
        </Button>
      )}

      {onExportSvg && (
        <>
          <span className="mx-1 h-5 w-px bg-(--color-border)" />
          <Button type="button" compact tone="quiet" disabled={!canExport} onClick={onExportSvg}>{t("toolbar.exportSvg")}</Button>
          {onExportPng && (
            <Button type="button" compact tone="quiet" disabled={!canExport} onClick={onExportPng}>{t("toolbar.exportPng")}</Button>
          )}
        </>
      )}

      <span className="ms-auto flex items-center gap-2">
        {dirty && <span className="text-xs text-(--color-fg-muted)">{t("toolbar.unsavedChanges")}</span>}
        <Button type="button" compact tone="primary" disabled={saveDisabled ?? (saving || !dirty)} onClick={onSave}>
          {saving ? t("toolbar.saving") : (saveLabel ?? t("toolbar.save"))}
        </Button>
      </span>
    </div>
  );
}
