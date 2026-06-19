// src/features/forms/ui/form-detail.tsx
import { AstRender } from "@/components/ast-render";
import { getT } from "@/i18n";

import type { Form } from "../types";

import { FormMeta } from "./form-meta";

export async function FormDetail({ form }: { form: Form }) {
  const t = await getT("forms");
  const description = form.description ?? [];
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{form.title ?? t("untitled")}</h1>
      <FormMeta form={form} />
      {description.length > 0 && (
        <article className="content">
          <AstRender blocks={description} />
        </article>
      )}
    </div>
  );
}
