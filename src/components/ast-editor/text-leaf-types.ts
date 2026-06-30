// Типы AST-узлов, несущих текстовый лист с собственным node_id (sub-block anchor).
// ЕДИНЫЙ источник истины для serializer/deserializer: набор ОБЯЗАН совпадать в обе
// стороны, иначе round-trip молча теряет id листа. Не дублировать литерал по месту.
export const TEXT_LEAF_NODE_TYPES = new Set(["paragraph", "heading", "code_block", "table_cell"]);
