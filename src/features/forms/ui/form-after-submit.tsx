"use client";
// src/features/forms/ui/form-after-submit.tsx
import { AstRender } from "@/components/ast-render";
import { useT } from "@/i18n/client";

import type { AstBlock } from "../types";

export function FormAfterSubmit({ blocks }: { blocks: AstBlock[] }) {
  const t = useT("forms");
  if (blocks.length === 0) return null;
  return (
    <section className="rounded border border-(--color-border) p-4">
      <h2 className="mb-2 text-sm font-semibold">{t("afterSubmitTitle")}</h2>
      <article className="content">
        <AstRender blocks={blocks} />
      </article>
    </section>
  );
}
