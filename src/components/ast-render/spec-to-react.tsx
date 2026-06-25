import { createElement, type ReactNode } from "react";

import { HOLE, type NeutralChild } from "@/components/ast-content-map";

/**
 * Булевы HTML-атрибуты: в нейтральной карте их ПРИСУТСТВИЕ (значение "") = true.
 * React ждёт boolean-проп — строка "" falsy → атрибут потерялся бы. Маппим имя в
 * React-форму (readonly→readOnly) и выставляем `true`. Нужно для disabled/checked
 * read-чекбокса задачи, который рендерится из общей карты.
 */
const BOOLEAN_ATTR_PROPS: Record<string, string> = {
  checked: "checked",
  disabled: "disabled",
  readonly: "readOnly",
  selected: "selected",
  multiple: "multiple",
};

/** NeutralSpec → ReactNode. HOLE заменяется на `children`. attrs.class → className. */
export function specToReact(spec: NeutralChild, children: ReactNode, keyHint?: string): ReactNode {
  if (spec === HOLE) return children;
  if (typeof spec === "string") return spec;
  const [tag, attrs, ...kids] = spec;
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    const boolProp = BOOLEAN_ATTR_PROPS[k];
    if (boolProp !== undefined) props[boolProp] = true;
    else props[k === "class" ? "className" : k] = v;
  }
  if (keyHint != null) props.key = keyHint;
  const renderedKids = kids.map((k, i) => specToReact(k, children, String(i)));
  // Дети — ПОЗИЦИОННЫМИ аргументами (spread), а не одним массивом-children:
  // HOLE возвращает `children` без key, и массив-из-одного-такого-ребёнка даёт
  // React key-warning ("unique key prop"). Spread → дети позиционны, key не нужен;
  // пустой spread эквивалентен отсутствию детей. DOM не меняется.
  return createElement(tag, props, ...renderedKids);
}
