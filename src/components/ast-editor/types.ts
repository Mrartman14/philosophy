// src/components/ast-editor/types.ts
import type { components } from "@/api/schema";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type ExportedAttr = components["schemas"]["ast.ExportedAttr"];
export type ExportedElement = components["schemas"]["ast.ExportedElement"];
export type ExportedNode = components["schemas"]["ast.ExportedNode"];
export type SchemaResponse = components["schemas"]["ast.SchemaResponse"];

export type EntityContext =
  | "document"
  | "glossary"
  | "comment"
  | "annotation"
  | "banner"
  | "event"
  | "form";

/** Snapshot of /api/ast/schema fetched at runtime. */
export interface SchemaSnapshot {
  blockLevels: Record<string, string[]>;
  entityBlockLimits: Record<string, number>;
  entityContexts: Record<string, string>;
  limits: {
    maxDepth: number;
    maxTextLen: number;
    maxContentItems: number;
    maxMarksPerNode: number;
  };
  urlPolicy: {
    dangerousSchemes: string[];
  };
  /** Map keyed by NodeType → ExportedNode (Content, Marks, Leaf, Attrs). */
  nodes: Map<string, ExportedNode>;
  /** Map keyed by MarkType → ExportedElement (Category, Attrs). */
  marks: Map<string, ExportedElement>;
  exclusiveCategories: string[];
}
