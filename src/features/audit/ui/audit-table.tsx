// src/features/audit/ui/audit-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";

import type { AuditRecord } from "../types";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "medium",
});

function formatCreatedAt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFormat.format(d);
}

function shortId(id?: string): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function AuditDetails({ record }: { record: AuditRecord }) {
  const details = record.details ?? {};
  const fieldCount = Object.keys(details).length;
  if (fieldCount === 0 && !record.request_id) return <>—</>;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-(--color-description)">
        Показать{fieldCount > 0 ? ` (${fieldCount})` : ""}
      </summary>
      {fieldCount > 0 && (
        <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-(--color-text-pane) p-2 text-xs">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
      {record.request_id && (
        <p className="mt-1 text-xs text-(--color-description)">
          request_id: <code>{record.request_id}</code>
        </p>
      )}
    </details>
  );
}

interface Props {
  records: AuditRecord[];
}

export function AuditTable({ records }: Props) {
  if (records.length === 0) {
    return (
      <EmptyState
        title="Записей не найдено"
        description="Попробуйте ослабить фильтры или расширить период."
      />
    );
  }
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Время</Th>
          <Th>Актор</Th>
          <Th>Действие</Th>
          <Th>Цель</Th>
          <Th>Детали</Th>
        </Tr>
      </Thead>
      <Tbody>
        {records.map((rec, i) => (
          <Tr key={rec.id ?? i}>
            <Td className="whitespace-nowrap" title={rec.created_at}>
              {formatCreatedAt(rec.created_at)}
            </Td>
            <Td>
              <div className="flex flex-col">
                {/* у удалённого актора username пустой — LEFT JOIN на беке */}
                {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- бек возвращает "" для удалённого актора (LEFT JOIN), "" → "—" намеренно */}
                <span>{rec.actor_username || "—"}</span>
                <code
                  className="text-xs text-(--color-description)"
                  title={rec.actor_user_id}
                >
                  {shortId(rec.actor_user_id)}
                </code>
              </div>
            </Td>
            <Td>
              <code className="text-xs">{rec.action ?? "—"}</code>
            </Td>
            <Td>
              {rec.target_type ? (
                <div className="flex flex-col">
                  <span>{rec.target_type}</span>
                  <code
                    className="text-xs text-(--color-description)"
                    title={rec.target_id}
                  >
                    {shortId(rec.target_id)}
                  </code>
                </div>
              ) : (
                "—"
              )}
            </Td>
            <Td>
              <AuditDetails record={rec} />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
