// src/features/forms/ui/form-detail.tsx
import { AstRender } from "@/components/ast-render";
import { FormMeta } from "./form-meta";
import type { Form } from "../types";

export function FormDetail({ form }: { form: Form }) {
  const description = form.description ?? [];
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{form.title || "Форма"}</h1>
      <FormMeta form={form} />
      {description.length > 0 && (
        <article className="prose max-w-none">
          <AstRender blocks={description} />
        </article>
      )}
    </div>
  );
}
