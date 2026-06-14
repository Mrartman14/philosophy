"use client";
// src/features/canvas/ui/editor-toolbar.tsx
import { Button } from "@/components/ui";
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
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-(--color-border) p-2">
      <Button type="button" size="sm" variant="ghost" onClick={onBack}>← Назад</Button>
      <span className="mx-1 h-5 w-px bg-(--color-border)" />

      <Button type="button" size="sm" onClick={onAddText}>Текст</Button>
      <Button type="button" size="sm" onClick={() => { onAddShape("rect"); }}>Прямоуг.</Button>
      <Button type="button" size="sm" onClick={() => { onAddShape("ellipse"); }}>Эллипс</Button>
      <Button type="button" size="sm" onClick={() => { onAddShape("diamond"); }}>Ромб</Button>
      <Button type="button" size="sm" onClick={onAddEntityRef}>Ссылка</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" size="sm" variant="danger" disabled={!hasSelection} onClick={() => { dispatch({ type: "deleteSelection" }); }}>
        Удалить
      </Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" size="sm" variant="ghost" disabled={!canUndo} onClick={() => { dispatch({ type: "undo" }); }} aria-label="Отменить">↶</Button>
      <Button type="button" size="sm" variant="ghost" disabled={!canRedo} onClick={() => { dispatch({ type: "redo" }); }} aria-label="Повторить">↷</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" size="sm" variant={gridEnabled ? "primary" : "ghost"} onClick={() => { dispatch({ type: "toggleGrid" }); }}>
        Сетка
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onToggleJson}>
        {showJson ? "Холст" : "JSON"}
      </Button>

      <span className="ml-auto flex items-center gap-2">
        {dirty && <span className="text-xs text-(--color-description)">Есть несохранённые изменения</span>}
        <Button type="button" size="sm" variant="primary" disabled={saving || !dirty} onClick={onSave}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </span>
    </div>
  );
}
