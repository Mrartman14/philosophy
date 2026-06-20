import type { AstBlock } from "@/components/ast-editor";

import type { MergeDecisions, MergeEntry } from "./types";

/** Собирает итоговые блоки по статусам и решениям пользователя. Removed-блоки
 *  выпадают; для conflict/structural берётся выбранная сторона. position
 *  перештамповывается по финальному порядку (бэкенд использует position как индекс). */
export function assembleMerged(
  entries: MergeEntry[],
  decisions: MergeDecisions,
): AstBlock[] {
  const out: AstBlock[] = [];
  for (const e of entries) {
    switch (e.status) {
      case "unchanged":
      case "server-only":
      case "added-server":
        if (e.theirs) out.push(e.theirs);
        else if (e.mine) out.push(e.mine);
        break;
      case "mine-only":
      case "added-mine":
        if (e.mine) out.push(e.mine);
        break;
      case "removed-mine":
      case "removed-server":
        break; // чистое удаление — выбрасываем
      case "conflict":
      case "structural-conflict": {
        const choice = decisions[e.key];
        if (choice === "theirs" && e.theirs) out.push(e.theirs);
        else if (choice === "mine" && e.mine) out.push(e.mine);
        // structural, где выбранная сторона = null (принятое удаление) → ничего
        break;
      }
    }
  }
  return out.map((b, i) => ({ ...b, position: i }));
}
