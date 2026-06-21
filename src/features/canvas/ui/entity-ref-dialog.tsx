"use client";
// src/features/canvas/ui/entity-ref-dialog.tsx
import { useState } from "react";

import { CanvasPicker } from "@/components/ast-editor/pickers/canvas-picker";
import { DocumentPicker } from "@/components/ast-editor/pickers/document-picker";
import { GlossaryPicker } from "@/components/ast-editor/pickers/glossary-picker";
import { LecturePicker } from "@/components/ast-editor/pickers/lecture-picker";
import { MediaPicker } from "@/components/ast-editor/pickers/media-picker";
import { Dialog, Label, Select, TextInput, Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { CanvasRefEntityType } from "../types";

/** Типы с готовым AsyncCombobox-пикером. Остальные — ручной ввод id. */
const PICKER_TYPES = new Set(["document", "lecture", "glossary", "media", "canvas"]);

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (entityType: CanvasRefEntityType, entityId: string) => void;
}

/**
 * Диалог создания entity_ref-узла. Для 5 типов с пикером (document/lecture/
 * glossary/media/canvas) показывает AsyncCombobox; для остальных — поле ручного
 * ввода id. anchor не задаётся (вне MVP — entity_ref без anchor валиден для
 * всех типов). Бек проверит существование+видимость цели при сохранении.
 *
 * Контракт Dialog (подтверждён по src/components/ui/dialog.tsx): контролируемый
 * режим через `open` + `onOpenChange(next: boolean)`; `title` обязателен.
 * Колбэк onOpenChange(false) ⇒ закрытие.
 */
export function EntityRefDialog({ open, onClose, onConfirm }: Props) {
  const t = useT("canvas");
  const [entityType, setEntityType] = useState<CanvasRefEntityType>("document");
  const [manualId, setManualId] = useState("");

  const usePicker = PICKER_TYPES.has(entityType);

  /** Все 10 типов entity_ref (порядок UI). */
  const entityTypes: { value: CanvasRefEntityType; label: string }[] = [
    { value: "document", label: t("entityRefDialog.typeDocument") },
    { value: "lecture", label: t("entityRefDialog.typeLecture") },
    { value: "glossary", label: t("entityRefDialog.typeGlossary") },
    { value: "media", label: t("entityRefDialog.typeMedia") },
    { value: "canvas", label: t("entityRefDialog.typeCanvas") },
    { value: "comment", label: t("entityRefDialog.typeComment") },
    { value: "annotation", label: t("entityRefDialog.typeAnnotation") },
    { value: "form", label: t("entityRefDialog.typeForm") },
    { value: "banner", label: t("entityRefDialog.typeBanner") },
    { value: "event", label: t("entityRefDialog.typeEvent") },
  ];

  const reset = () => {
    setManualId("");
    onClose();
  };
  const pick = (id: string) => {
    onConfirm(entityType, id);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) reset(); }}
      title={t("entityRefDialog.title")}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 text-sm">
          {t("entityRefDialog.typeLabel")}
          <Select
            name="entity_type"
            aria-label={t("entityRefDialog.typeAriaLabel")}
            value={entityType}
            onValueChange={(v) => { setEntityType(v as CanvasRefEntityType); }}
            options={entityTypes}
          />
        </div>

        {usePicker ? (
          <div className="entity-ref-picker">
            {entityType === "document" && <DocumentPicker onSelect={(id) => { pick(id); }} />}
            {entityType === "lecture" && <LecturePicker onSelect={(id) => { pick(id); }} />}
            {entityType === "glossary" && <GlossaryPicker onSelect={(id) => { pick(id); }} />}
            {entityType === "media" && <MediaPicker onSelect={(id) => { pick(id); }} />}
            {entityType === "canvas" && <CanvasPicker onSelect={(id) => { pick(id); }} />}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="entity_id">{t("entityRefDialog.idLabel")}</Label>
              <TextInput
                id="entity_id"
                name="entity_id"
                value={manualId}
                onChange={(e) => { setManualId(e.target.value); }}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <Button
              type="button"
              disabled={manualId.trim() === ""}
              onClick={() => { if (manualId.trim()) pick(manualId.trim()); }}
            >
              {t("entityRefDialog.addButton")}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
