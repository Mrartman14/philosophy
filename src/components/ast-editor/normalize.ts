import { deserialize } from "./deserializer";
import { serialize } from "./serializer";
import type { AstBlock } from "./types";

/** Приводит блоки (в т.ч. серверной формы из API) к канонической редакторной
 *  форме — той же, что выдаёт онлайн-редактор: фиксированный порядок ключей и
 *  всегда заполненный `text` (extractText). Нужно, чтобы сравнение/diff блоков
 *  не ломалось из-за расхождения серверной и редакторной сериализации. Чистая. */
export function normalizeBlocks(blocks: AstBlock[]): AstBlock[] {
  return serialize(deserialize(blocks));
}
