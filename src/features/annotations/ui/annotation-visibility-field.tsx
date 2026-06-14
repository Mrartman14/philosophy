"use client";
// src/features/annotations/ui/annotation-visibility-field.tsx
import { useState } from "react";

/**
 * Выбор видимости ПРИ создании. После создания видимость не меняется (§6.8) —
 * поэтому это поле есть только в create-форме, в edit-форме его нет.
 * Рендерит hidden-input name="visibility" для FormData.
 */
export function AnnotationVisibilityField() {
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="text-(--color-description)">Видимость</legend>
      <input type="hidden" name="visibility" value={visibility} />
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "private"}
          onChange={() => { setVisibility("private"); }}
        />
        Приватная (видна только мне)
      </label>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "public"}
          onChange={() => { setVisibility("public"); }}
        />
        Публичная (видна всем, кто видит сущность)
      </label>
      <p className="text-xs text-(--color-description)">
        Видимость нельзя изменить после создания.
      </p>
    </fieldset>
  );
}
