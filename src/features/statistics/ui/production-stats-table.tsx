// src/features/statistics/ui/production-stats-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import { getT } from "@/i18n";

import { entityLabels } from "../entity-labels";
import type { Inventory } from "../types";

/** number → строка; undefined (нет видимости, напр. comment) → «—».
 *  По schema.ts поля number|undefined (не null) — иначе no-unnecessary-condition. */
function fmt(n: number | undefined): string {
  return n === undefined ? "—" : String(n);
}

export async function ProductionStatsTable({ inventory }: { inventory: Inventory }) {
  const t = await getT("statistics");
  const rows = inventory.by_type ?? [];
  const totals = inventory.totals;
  const labels = entityLabels(t);

  if ((totals?.total ?? 0) === 0) {
    return (
      <EmptyState
        title={t("noProductionTitle")}
        description={t("noProductionDescription")}
      />
    );
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>{t("colType")}</Th>
          <Th className="text-end">{t("colTotal")}</Th>
          <Th className="text-end">{t("colPublic")}</Th>
          <Th className="text-end">{t("colPrivate")}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row, i) => (
          <Tr key={row.entity_type ?? `row-${i}`}>
            <Td>{labels[row.entity_type ?? ""] ?? row.entity_type}</Td>
            <Td className="text-end">{fmt(row.total)}</Td>
            <Td className="text-end">{fmt(row.public)}</Td>
            <Td className="text-end">{fmt(row.private)}</Td>
          </Tr>
        ))}
        <Tr className="font-semibold">
          <Td>{t("totalsRow")}</Td>
          <Td className="text-end">{fmt(totals?.total)}</Td>
          <Td className="text-end">{fmt(totals?.public)}</Td>
          <Td className="text-end">{fmt(totals?.private)}</Td>
        </Tr>
      </Tbody>
    </Table>
  );
}
