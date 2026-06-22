import type { Mark as PMMark } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import type { SchemaSnapshot, ExportedAttr } from "../types";

export const attrPluginKey = new PluginKey("ast-editor-attrs");

export function createAttrPlugin(snapshot: SchemaSnapshot) {
  const { nodes, marks, urlPolicy } = snapshot;

  return new Plugin({
    key: attrPluginKey,
    filterTransaction(tr) {
      if (!tr.docChanged) return true;
      let ok = true;
      tr.doc.descendants((node) => {
        if (!ok) return false;
        const nodeSpec = nodes.get(node.type.name);
        if (nodeSpec?.attrs) {
          for (const [name, spec] of Object.entries(nodeSpec.attrs)) {
            if (!validateAttr(node.attrs[name], spec, urlPolicy.dangerousSchemes)) {
              ok = false;
              return false;
            }
          }
        }
        for (const m of node.marks) {
          if (!validateMark(m, marks, urlPolicy.dangerousSchemes)) {
            ok = false;
            return false;
          }
        }
        return true;
      });
      return ok;
    },
  });
}

function validateMark(
  mark: PMMark,
  registry: Map<string, { attrs?: Record<string, ExportedAttr> }>,
  dangerousSchemes: string[],
): boolean {
  const spec = registry.get(mark.type.name);
  if (!spec?.attrs) return true;
  for (const [name, attr] of Object.entries(spec.attrs)) {
    if (!validateAttr(mark.attrs[name], attr, dangerousSchemes)) return false;
  }
  return true;
}

function validateAttr(
  value: unknown,
  spec: ExportedAttr,
  dangerousSchemes: string[],
): boolean {
  if (value === null || value === undefined || value === "") {
    return !spec.required;
  }
  if (spec.type === "string" || spec.type === "uuid" || spec.type === "url") {
    if (typeof value !== "string") return false;
    if (spec.min_len && value.length < spec.min_len) return false;
    if (spec.max_len && value.length > spec.max_len) return false;
    // hex_only снят из контракта ast.ExportedAttr (бэк валидирует hex сам).
    if (spec.scheme_allowlist && spec.scheme_allowlist.length > 0) {
      const scheme = extractScheme(value);
      if (scheme && !spec.scheme_allowlist.includes(scheme)) return false;
    }
    if (spec.type === "url" || spec.type === "string") {
      const scheme = extractScheme(value);
      if (scheme && dangerousSchemes.includes(scheme)) return false;
    }
  } else if (spec.type === "int" || spec.type === "number") {
    if (typeof value !== "number") return false;
    if (spec.min != null && value < spec.min) return false;
    if (spec.max != null && value > spec.max) return false;
  } else if (spec.type === "bool") {
    if (typeof value !== "boolean") return false;
  } else if (spec.type === "enum") {
    if (typeof value !== "string") return false;
    if (spec.enum && !spec.enum.includes(value)) return false;
  } else if (spec.type === "string_array") {
    if (!Array.isArray(value)) return false;
  }
  return true;
}

function extractScheme(s: string): string | null {
  const m = /^([a-z][a-z0-9+\-.]*):/i.exec(s);
  return m ? (m[1] ?? "").toLowerCase() : null;
}
