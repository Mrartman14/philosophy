"use client";
// src/features/canvas/ui/editor-toolbar.tsx
import type { ReactNode } from "react";

import { BracesIcon } from "@/assets/icons/braces-icon";
import { ChevronIcon } from "@/assets/icons/chevron-icon";
import { CursorIcon } from "@/assets/icons/cursor-icon";
import { DownloadIcon } from "@/assets/icons/download-icon";
import { HandIcon } from "@/assets/icons/hand-icon";
import { LinkIcon } from "@/assets/icons/link-icon";
import { RedoIcon } from "@/assets/icons/redo-icon";
import { ResetIcon } from "@/assets/icons/reset-icon";
import { ShapeDiamondIcon } from "@/assets/icons/shape-diamond-icon";
import { ShapeEllipseIcon } from "@/assets/icons/shape-ellipse-icon";
import { ShapeRectIcon } from "@/assets/icons/shape-rect-icon";
import { TextIcon } from "@/assets/icons/text-icon";
import { TrashIcon } from "@/assets/icons/trash-icon";
import { UndoIcon } from "@/assets/icons/undo-icon";
import { Button, IconButton, type IconButtonTone, Tooltip } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { CanvasTool, EditorCommand } from "../editor";

interface Props {
  dispatch: (c: EditorCommand) => void;
  /** Активный инструмент холста (Select/Hand). */
  tool: CanvasTool;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
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

/** Вертикальный разделитель между группами иконок. */
function Sep() {
  return <span className="mx-1 h-5 w-px bg-(--color-border)" />;
}

interface TbButtonProps {
  /** Подсказка (тултип) и доступное имя кнопки — одна строка. */
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: IconButtonTone;
  disabled?: boolean;
  /** Состояние тоггла; задаёт `aria-pressed`. Не указывать для обычных кнопок. */
  pressed?: boolean;
}

/**
 * Иконочная кнопка тулбара: `label` служит и `aria-label` (доступное имя), и
 * контентом тултипа — текст «переехал» в подсказку, как просили. Тултип несёт
 * лишь описание, поэтому `aria-label` обязателен отдельно.
 */
function TbButton({ label, onClick, children, tone = "neutral", disabled, pressed }: TbButtonProps) {
  return (
    <Tooltip content={label}>
      <IconButton
        type="button"
        compact
        aria-label={label}
        aria-pressed={pressed}
        tone={tone}
        disabled={disabled}
        onClick={onClick}
      >
        {/* Иконки рисуются в `1em`; явный text-размер задаёт их геометрию,
            т.к. CONTROL_BOX font-size не выставляет. */}
        <span className="inline-flex text-lg">{children}</span>
      </IconButton>
    </Tooltip>
  );
}

/** Тулбар редактора: создание узлов, удаление, история, сохранение. */
export function EditorToolbar({
  dispatch, tool, canUndo, canRedo, dirty, saving, showJson, hasSelection,
  onAddText, onAddShape, onAddEntityRef, onSave, onToggleJson, onBack,
  saveLabel, saveDisabled, hideJsonToggle,
  onExportSvg, onExportPng, canExport,
}: Props) {
  const t = useT("canvas");

  return (
    <Tooltip.Provider delay={400}>
      <div className="flex flex-wrap items-center gap-1 border-b border-(--color-border) p-2">
        <TbButton label={t("toolbar.back")} onClick={onBack}>
          <ChevronIcon className="rtl-flip rotate-180" />
        </TbButton>
        <Sep />

        <TbButton
          label={t("toolbar.toolSelect")}
          pressed={tool === "select"}
          tone={tool === "select" ? "primary" : "neutral"}
          onClick={() => { dispatch({ type: "setTool", tool: "select" }); }}
        >
          <CursorIcon />
        </TbButton>
        <TbButton
          label={t("toolbar.toolHand")}
          pressed={tool === "hand"}
          tone={tool === "hand" ? "primary" : "neutral"}
          onClick={() => { dispatch({ type: "setTool", tool: "hand" }); }}
        >
          <HandIcon />
        </TbButton>
        <Sep />

        <TbButton label={t("toolbar.addText")} onClick={onAddText}>
          <TextIcon />
        </TbButton>
        <TbButton label={t("toolbar.addRect")} onClick={() => { onAddShape("rect"); }}>
          <ShapeRectIcon />
        </TbButton>
        <TbButton label={t("toolbar.addEllipse")} onClick={() => { onAddShape("ellipse"); }}>
          <ShapeEllipseIcon />
        </TbButton>
        <TbButton label={t("toolbar.addDiamond")} onClick={() => { onAddShape("diamond"); }}>
          <ShapeDiamondIcon />
        </TbButton>
        <TbButton label={t("toolbar.addLink")} onClick={onAddEntityRef}>
          <LinkIcon />
        </TbButton>
        <Sep />

        <TbButton
          label={t("toolbar.deleteSelected")}
          tone="danger"
          disabled={!hasSelection}
          onClick={() => { dispatch({ type: "deleteSelection" }); }}
        >
          <TrashIcon />
        </TbButton>
        <Sep />

        <TbButton label={t("toolbar.undoAriaLabel")} disabled={!canUndo} onClick={() => { dispatch({ type: "undo" }); }}>
          <UndoIcon />
        </TbButton>
        <TbButton label={t("toolbar.redoAriaLabel")} disabled={!canRedo} onClick={() => { dispatch({ type: "redo" }); }}>
          <RedoIcon />
        </TbButton>
        <TbButton label={t("toolbar.reset")} disabled={!dirty} onClick={() => { dispatch({ type: "reset" }); }}>
          <ResetIcon />
        </TbButton>

        {!hideJsonToggle && (
          <>
            <Sep />
            <TbButton
              label={showJson ? t("toolbar.showCanvas") : t("toolbar.showJson")}
              pressed={showJson}
              tone={showJson ? "primary" : "neutral"}
              onClick={onToggleJson}
            >
              <BracesIcon />
            </TbButton>
          </>
        )}

        {onExportSvg && (
          <>
            <Sep />
            <TbButton label={t("toolbar.exportSvg")} disabled={!canExport} onClick={onExportSvg}>
              <DownloadIcon />
            </TbButton>
            {onExportPng && (
              <TbButton label={t("toolbar.exportPng")} disabled={!canExport} onClick={onExportPng}>
                <DownloadIcon />
              </TbButton>
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
    </Tooltip.Provider>
  );
}
