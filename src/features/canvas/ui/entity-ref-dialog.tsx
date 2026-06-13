"use client";
// src/features/canvas/ui/entity-ref-dialog.tsx
import { useState } from "react";
import { Dialog, Select, TextInput, Button } from "@/components/ui";
import { DocumentPicker } from "@/components/ast-editor/pickers/document-picker";
import { LecturePicker } from "@/components/ast-editor/pickers/lecture-picker";
import { GlossaryPicker } from "@/components/ast-editor/pickers/glossary-picker";
import { MediaPicker } from "@/components/ast-editor/pickers/media-picker";
import { CanvasPicker } from "@/components/ast-editor/pickers/canvas-picker";

/** Все 10 типов entity_ref (порядок UI). */
const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: "document", label: "Документ" },
  { value: "lecture", label: "Лекция" },
  { value: "glossary", label: "Глоссарий" },
  { value: "media", label: "Медиа" },
  { value: "canvas", label: "Канвас" },
  { value: "comment", label: "Комментарий" },
  { value: "annotation", label: "Аннотация" },
  { value: "form", label: "Форма" },
  { value: "banner", label: "Баннер" },
  { value: "event", label: "Событие" },
];

/** Типы с готовым AsyncCombobox-пикером. Остальные — ручной ввод id. */
const PICKER_TYPES = new Set(["document", "lecture", "glossary", "media", "canvas"]);

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (entityType: string, entityId: string) => void;
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
  const [entityType, setEntityType] = useState("document");
  const [manualId, setManualId] = useState("");

  const usePicker = PICKER_TYPES.has(entityType);

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
      title="Добавить ссылку на сущность"
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Тип сущности
          <Select
            name="entity_type"
            value={entityType}
            onValueChange={setEntityType}
            options={ENTITY_TYPES}
          />
        </label>

        {usePicker ? (
          <div className="entity-ref-picker">
            {entityType === "document" && <DocumentPicker onSelect={(id) => pick(id)} />}
            {entityType === "lecture" && <LecturePicker onSelect={(id) => pick(id)} />}
            {entityType === "glossary" && <GlossaryPicker onSelect={(id) => pick(id)} />}
            {entityType === "media" && <MediaPicker onSelect={(id) => pick(id)} />}
            {entityType === "canvas" && <CanvasPicker onSelect={(id) => pick(id)} />}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              ID сущности (UUID)
              <TextInput
                name="entity_id"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </label>
            <Button
              type="button"
              disabled={manualId.trim() === ""}
              onClick={() => manualId.trim() && pick(manualId.trim())}
            >
              Добавить
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
