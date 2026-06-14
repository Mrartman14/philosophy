// src/features/forms/ui/form-after-submit.tsx
import { AstRender } from "@/components/ast-render";

import type { AstBlock } from "../types";

export function FormAfterSubmit({ blocks }: { blocks: AstBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <section className="rounded border border-(--color-border) p-4">
      <h2 className="mb-2 text-sm font-semibold">После отправки</h2>
      <article className="prose max-w-none">
        <AstRender blocks={blocks} />
      </article>
    </section>
  );
}
