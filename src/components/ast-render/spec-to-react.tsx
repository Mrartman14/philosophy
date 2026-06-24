import { createElement, type ReactNode } from "react";

import { HOLE, type NeutralChild } from "@/components/ast-content-map";

/** NeutralSpec → ReactNode. HOLE заменяется на `children`. attrs.class → className. */
export function specToReact(spec: NeutralChild, children: ReactNode, keyHint?: string): ReactNode {
  if (spec === HOLE) return children;
  if (typeof spec === "string") return spec;
  const [tag, attrs, ...kids] = spec;
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) props[k === "class" ? "className" : k] = v;
  if (keyHint != null) props.key = keyHint;
  const renderedKids = kids.map((k, i) => specToReact(k, children, String(i)));
  return createElement(tag, props, kids.length > 0 ? renderedKids : undefined);
}
