"use client";
// src/features/annotations/ui/annotation-visibility-field.tsx
import { useState } from "react";

import { useT } from "@/i18n/client";

/**
 * Выбор видимости ПРИ создании. После создания видимость не меняется (§6.8) —
 * поэтому это поле есть только в create-форме, в edit-форме его нет.
 * Рендерит hidden-input name="visibility" для FormData.
 */
export function AnnotationVisibilityField() {
  const t = useT("annotations");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="text-(--color-fg-muted)">{t("visibilityLegend")}</legend>
      <input type="hidden" name="visibility" value={visibility} />
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "private"}
          onChange={() => { setVisibility("private"); }}
        />
        {t("visibilityPrivateLabel")}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "public"}
          onChange={() => { setVisibility("public"); }}
        />
        {t("visibilityPublicLabel")}
      </label>
      <p className="text-xs text-(--color-fg-muted)">
        {t("visibilityImmutableNote")}
      </p>
    </fieldset>
  );
}
