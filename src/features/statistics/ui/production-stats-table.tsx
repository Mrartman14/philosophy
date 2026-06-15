// src/features/statistics/ui/production-stats-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";

import type { Inventory } from "../types";

const LABELS: Record<string, string> = {
  lecture: "Лекции",
  document: "Документы",
  canvas: "Канвасы",
  form: "Формы",
  trail: "Маршруты",
  media: "Медиа",
  annotation: "Аннотации",
  comment: "Комментарии",
};

/** number → строка; undefined (нет видимости, напр. comment) → «—».
 *  По schema.ts поля number|undefined (не null) — иначе no-unnecessary-condition. */
function fmt(n: number | undefined): string {
  return n === undefined ? "—" : String(n);
}

export function ProductionStatsTable({ inventory }: { inventory: Inventory }) {
  const rows = inventory.by_type ?? [];
  const totals = inventory.totals;

  if ((totals?.total ?? 0) === 0) {
    return (
      <EmptyState
        title="Вы пока ничего не создали"
        description="Здесь появится статистика по вашим лекциям, документам и другим материалам."
      />
    );
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Тип</Th>
          <Th className="text-right">Всего</Th>
          <Th className="text-right">Публичных</Th>
          <Th className="text-right">Приватных</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row, i) => (
          <Tr key={row.entity_type ?? `row-${i}`}>
            <Td>{LABELS[row.entity_type ?? ""] ?? row.entity_type}</Td>
            <Td className="text-right">{fmt(row.total)}</Td>
            <Td className="text-right">{fmt(row.public)}</Td>
            <Td className="text-right">{fmt(row.private)}</Td>
          </Tr>
        ))}
        <Tr className="font-semibold">
          <Td>Итого</Td>
          <Td className="text-right">{fmt(totals?.total)}</Td>
          <Td className="text-right">{fmt(totals?.public)}</Td>
          <Td className="text-right">{fmt(totals?.private)}</Td>
        </Tr>
      </Tbody>
    </Table>
  );
}
