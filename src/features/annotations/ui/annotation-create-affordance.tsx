// src/features/annotations/ui/annotation-create-affordance.tsx
// Server-ассемблер page-level действия «аннотировать»: считает право (плоская капа
// annotation.create) и серверно грузит AST-схему (композер монтирует AstEditor для
// тела аннотации), затем монтирует client-композер ОДИН раз на страницу под
// SchemaContextProvider. Зеркалит стиль DocumentAnnotations (связка движок↔домен).
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getMe } from "@/utils/me";

import { canCreateAnnotation } from "../permissions";

import { AnnotationSelectionComposer } from "./annotation-selection-composer";

export async function AnnotationCreateAffordance() {
  const me = await getMe();
  if (!canCreateAnnotation(me)) return null;
  // getAstSchema — unstable_cache: дедупится с загрузками в DocumentAnnotations/
  // CommentSection, нового HTTP нет.
  const astSchema = await getAstSchema();
  return (
    <SchemaContextProvider initial={astSchema}>
      <AnnotationSelectionComposer />
    </SchemaContextProvider>
  );
}
