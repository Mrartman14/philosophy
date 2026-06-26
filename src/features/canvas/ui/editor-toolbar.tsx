"use client";
// src/features/canvas/ui/editor-toolbar.tsx
import type { ReactNode } from "react";

import { BracesIcon } from "@/assets/icons/braces-icon";
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

/** Ориентация тулбара: horizontal (JSON-режим, полоса) | vertical (левое поле). */
type Orientation = "horizontal" | "vertical";

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
  /** Раскладка. По умолчанию горизонтальная полоса; vertical — столбец в поле. */
  orientation?: Orientation;
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

/** Разделитель между группами. vertical: ниже xl — вертикальная чёрточка (полоса),
 *  на xl+ — горизонтальная (столбец в поле). */
function Sep({ vertical }: { vertical: boolean }) {
  return (
    <span className={vertical
      ? "mx-1 h-5 w-px bg-(--color-border) xl:mx-0 xl:my-1 xl:h-px xl:w-7"
      : "mx-1 h-5 w-px bg-(--color-border)"} />
  );
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
  /** Сторона тултипа: в столбце — вправо (к холсту), в полосе — вверх. */
  tipSide: "top" | "right";
}

/**
 * Иконочная кнопка тулбара: `label` служит и `aria-label` (доступное имя), и
 * контентом тултипа — текст «переехал» в подсказку. Тултип несёт лишь описание,
 * поэтому `aria-label` обязателен отдельно.
 */
function TbButton({ label, onClick, children, tone = "neutral", disabled, pressed, tipSide }: TbButtonProps) {
  return (
    <Tooltip content={label} side={tipSide}>
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
  onAddText, onAddShape, onAddEntityRef, onSave, onToggleJson,
  orientation = "horizontal", saveLabel, saveDisabled, hideJsonToggle,
  onExportSvg, onExportPng, canExport,
}: Props) {
  const t = useT("canvas");
  const vertical = orientation === "vertical";
  const tip = vertical ? "right" : "top";

  // vertical = адаптивный: ниже xl поле схлопнуто → тулбар горизонтальной полосой
  // над холстом; на xl+ → столбец в левом поле.
  const containerClass = vertical
    ? "flex flex-wrap items-center gap-1 border-b border-(--color-border) p-2 xl:flex-col xl:flex-nowrap xl:items-start xl:border-b-0"
    : "flex flex-wrap items-center gap-1 border-b border-(--color-border) p-2";

  const saveCluster = (
    <Button type="button" compact tone="primary" disabled={saveDisabled ?? (saving || !dirty)} onClick={onSave}>
      {saving ? t("toolbar.saving") : (saveLabel ?? t("toolbar.save"))}
    </Button>
  );
  const unsaved = dirty
    ? <span className="text-xs text-(--color-fg-muted)">{t("toolbar.unsavedChanges")}</span>
    : null;

  return (
    <Tooltip.Provider delay={400}>
      <div className={containerClass}>
        <TbButton
          label={t("toolbar.toolSelect")} tipSide={tip}
          pressed={tool === "select"} tone={tool === "select" ? "primary" : "neutral"}
          onClick={() => { dispatch({ type: "setTool", tool: "select" }); }}
        >
          <CursorIcon />
        </TbButton>
        <TbButton
          label={t("toolbar.toolHand")} tipSide={tip}
          pressed={tool === "hand"} tone={tool === "hand" ? "primary" : "neutral"}
          onClick={() => { dispatch({ type: "setTool", tool: "hand" }); }}
        >
          <HandIcon />
        </TbButton>
        <Sep vertical={vertical} />

        <TbButton label={t("toolbar.addText")} tipSide={tip} onClick={onAddText}>
          <TextIcon />
        </TbButton>
        <TbButton label={t("toolbar.addRect")} tipSide={tip} onClick={() => { onAddShape("rect"); }}>
          <ShapeRectIcon />
        </TbButton>
        <TbButton label={t("toolbar.addEllipse")} tipSide={tip} onClick={() => { onAddShape("ellipse"); }}>
          <ShapeEllipseIcon />
        </TbButton>
        <TbButton label={t("toolbar.addDiamond")} tipSide={tip} onClick={() => { onAddShape("diamond"); }}>
          <ShapeDiamondIcon />
        </TbButton>
        <TbButton label={t("toolbar.addLink")} tipSide={tip} onClick={onAddEntityRef}>
          <LinkIcon />
        </TbButton>
        <Sep vertical={vertical} />

        <TbButton
          label={t("toolbar.deleteSelected")} tipSide={tip}
          tone="danger" disabled={!hasSelection}
          onClick={() => { dispatch({ type: "deleteSelection" }); }}
        >
          <TrashIcon />
        </TbButton>
        <Sep vertical={vertical} />

        <TbButton label={t("toolbar.undoAriaLabel")} tipSide={tip} disabled={!canUndo} onClick={() => { dispatch({ type: "undo" }); }}>
          <UndoIcon />
        </TbButton>
        <TbButton label={t("toolbar.redoAriaLabel")} tipSide={tip} disabled={!canRedo} onClick={() => { dispatch({ type: "redo" }); }}>
          <RedoIcon />
        </TbButton>
        <TbButton label={t("toolbar.reset")} tipSide={tip} disabled={!dirty} onClick={() => { dispatch({ type: "reset" }); }}>
          <ResetIcon />
        </TbButton>

        {!hideJsonToggle && (
          <>
            <Sep vertical={vertical} />
            <TbButton
              label={showJson ? t("toolbar.showCanvas") : t("toolbar.showJson")} tipSide={tip}
              pressed={showJson} tone={showJson ? "primary" : "neutral"}
              onClick={onToggleJson}
            >
              <BracesIcon />
            </TbButton>
          </>
        )}

        {onExportSvg && (
          <>
            <Sep vertical={vertical} />
            <TbButton label={t("toolbar.exportSvg")} tipSide={tip} disabled={!canExport} onClick={onExportSvg}>
              <DownloadIcon />
            </TbButton>
            {onExportPng && (
              <TbButton label={t("toolbar.exportPng")} tipSide={tip} disabled={!canExport} onClick={onExportPng}>
                <DownloadIcon />
              </TbButton>
            )}
          </>
        )}

        {/* Save-кластер отжат вправо (ms-auto). В vertical на xl+ переезжает вниз
            столбцом: индикатор «не сохранено» над кнопкой. */}
        <span className={vertical
          ? "ms-auto flex items-center gap-2 xl:ms-0 xl:mt-2 xl:w-full xl:flex-col xl:items-start"
          : "ms-auto flex items-center gap-2"}>
          {unsaved}
          {saveCluster}
        </span>
      </div>
    </Tooltip.Provider>
  );
}
