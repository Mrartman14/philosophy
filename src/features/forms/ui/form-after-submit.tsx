// src/features/forms/ui/form-after-submit.tsx
import { AstRender } from "@/components/ast-render";
import { getT } from "@/i18n";

import type { AstBlock } from "../types";

export async function FormAfterSubmit({ blocks }: { blocks: AstBlock[] }) {
  if (blocks.length === 0) return null;
  const t = await getT("forms");
  return (
    <section className="rounded border border-(--color-border) p-4">
      <h2 className="mb-2 text-sm font-semibold">{t("afterSubmitTitle")}</h2>
      <article className="content">
        <AstRender blocks={blocks} />
      </article>
    </section>
  );
}
