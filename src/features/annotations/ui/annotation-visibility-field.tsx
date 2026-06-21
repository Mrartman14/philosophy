"use client";
// src/features/annotations/ui/annotation-visibility-field.tsx
import { useState } from "react";

import { Fieldset, Inline, Label } from "@/components/ui";
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
      <Inline align="center" gap="tight">
        <input
          id="visibility-private"
          type="radio"
          name="visibility-radio"
          checked={visibility === "private"}
          onChange={() => { setVisibility("private"); }}
        />
        <Label htmlFor="visibility-private">{t("visibilityPrivateLabel")}</Label>
      </Inline>
      <Inline align="center" gap="tight">
        <input
          id="visibility-public"
          type="radio"
          name="visibility-radio"
          checked={visibility === "public"}
          onChange={() => { setVisibility("public"); }}
        />
        <Label htmlFor="visibility-public">{t("visibilityPublicLabel")}</Label>
      </Inline>
      <p className="text-xs text-(--color-fg-muted)">
        {t("visibilityImmutableNote")}
      </p>
    </Fieldset>
  );
}
