// src/i18n/messages/pseudo/index.ts
// Псевдолокаль (en-XA): каталог ГЕНЕРИТСЯ из en алгоритмически (см. ../../pseudo),
// без ручного перевода. Ключи = en ⇒ паритет by construction, всегда в синке.
// Назначение — визуальный QA лейаута (экспансия/усечение/захардкоженные строки).
import { pseudoizeCatalog } from "../../pseudo";
import en from "../en";
import type { Messages } from "../ru";

const pseudo = pseudoizeCatalog(en) satisfies Messages;

export default pseudo;
