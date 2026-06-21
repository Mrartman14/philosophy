"use client";
// src/features/annotations/ui/annotation-visibility-field.tsx
import { useState } from "react";

import { Fieldset, Label } from "@/components/ui";
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
    <Fieldset legend={t("visibilityLegend")} className="text-sm">
      <input type="hidden" name="visibility" value={visibility} />
      <Label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "private"}
          onChange={() => { setVisibility("private"); }}
        />
        {t("visibilityPrivateLabel")}
      </Label>
      <Label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "public"}
          onChange={() => { setVisibility("public"); }}
        />
        {t("visibilityPublicLabel")}
      </Label>
      <p className="text-xs text-(--color-fg-muted)">
        {t("visibilityImmutableNote")}
      </p>
    </Fieldset>
  );
}
