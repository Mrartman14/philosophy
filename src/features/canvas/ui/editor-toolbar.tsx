"use client";
// src/features/canvas/ui/editor-toolbar.tsx
import type { ReactNode } from "react";

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
import { IconButton, type IconButtonTone, Menu, Tooltip } from "@/components/ui";
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
  hasSelection: boolean;
  onAddText: () => void;
  onAddShape: (kind: "rect" | "ellipse" | "diamond") => void;
  onAddEntityRef: () => void;
  /** Раскладка. По умолчанию горизонтальная полоса; vertical — столбец в поле. */
  orientation?: Orientation;
  /** Экспорт графа. Без `onExportSvg` кнопка скачивания (дропдаун форматов) скрыта. */
  onExportSvg?: (() => void) | undefined;
  onExportPng?: (() => void) | undefined;
  onExportJson?: (() => void) | undefined;
  /** Есть что экспортировать (граф непустой). */
  canExport?: boolean | undefined;
}

/** Разделитель между группами. vertical: ниже xl — вертикальная чёрточка (полоса),
 *  на xl+ — горизонтальная (столбец в поле). */
function Sep({ vertical }: { vertical: boolean }) {
  return (
    <span className={vertical
      ? "mx-1 h-5 w-px bg-(--color-border) xl:col-span-2 xl:mx-0 xl:my-1 xl:h-px xl:w-full"
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

/** Тулбар редактора: инструменты, создание узлов, удаление, история, экспорт.
 *  Save и приватность живут в панели-шапке редактора, не здесь. */
export function EditorToolbar({
  dispatch, tool, canUndo, canRedo, dirty, hasSelection,
  onAddText, onAddShape, onAddEntityRef,
  orientation = "horizontal",
  onExportSvg, onExportPng, onExportJson, canExport,
}: Props) {
  const t = useT("canvas");
  const vertical = orientation === "vertical";
  const tip = vertical ? "right" : "top";

  // vertical = адаптивный: ниже xl поле схлопнуто → тулбар горизонтальной полосой
  // над холстом; на xl+ → сетка 2×N иконок в левом поле, прижатая к холсту (ms-auto),
  // разделители — на всю ширину обеих колонок.
  const containerClass = vertical
    ? "flex flex-wrap items-center gap-1 border-b border-(--color-border) p-2 xl:ms-auto xl:grid xl:w-fit xl:grid-cols-2 xl:items-start xl:justify-items-center xl:rounded-lg xl:border"
    : "flex flex-wrap items-center gap-1 border-b border-(--color-border) p-2";

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

        {onExportSvg && (
          <>
            <Sep vertical={vertical} />
            {/* Одна кнопка скачивания → дропдаун со всеми форматами (SVG/PNG/JSON). */}
            <Menu.Root>
              <Menu.Trigger
                render={
                  <IconButton type="button" compact aria-label={t("toolbar.export")} title={t("toolbar.export")} disabled={!canExport}>
                    <span className="inline-flex text-lg"><DownloadIcon /></span>
                  </IconButton>
                }
              />
              <Menu.Portal>
                <Menu.Positioner side={vertical ? "right" : "bottom"} align="start" sideOffset={6}>
                  <Menu.Popup>
                    <Menu.Item onClick={onExportSvg}>{t("toolbar.exportSvg")}</Menu.Item>
                    {onExportPng && <Menu.Item onClick={onExportPng}>{t("toolbar.exportPng")}</Menu.Item>}
                    {onExportJson && <Menu.Item onClick={onExportJson}>{t("toolbar.exportJson")}</Menu.Item>}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </>
        )}

      </div>
    </Tooltip.Provider>
  );
}
