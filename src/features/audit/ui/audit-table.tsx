// src/features/audit/ui/audit-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import { getServerFmt, getT } from "@/i18n";

import type { AuditRecord } from "../types";

function shortId(id?: string): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

interface DetailsProps {
  record: AuditRecord;
  toggleLabel: string;
}

function AuditDetails({ record, toggleLabel }: DetailsProps) {
  const details = record.details ?? {};
  const fieldCount = Object.keys(details).length;
  if (fieldCount === 0 && !record.request_id) return <>—</>;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-(--color-fg-muted)">
        {toggleLabel}{fieldCount > 0 ? ` (${fieldCount})` : ""}
      </summary>
      {fieldCount > 0 && (
        <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-(--color-surface-subtle) p-2 text-xs">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
      {record.request_id && (
        <p className="mt-1 text-xs text-(--color-fg-muted)">
          request_id: <code>{record.request_id}</code>
        </p>
      )}
    </details>
  );
}

interface Props {
  records: AuditRecord[];
}

export async function AuditTable({ records }: Props) {
  const [t, fmt] = await Promise.all([getT("audit"), getServerFmt()]);

  function formatCreatedAt(iso?: string): string {
    if (!iso) return "—";
    return fmt.dateTime(iso, { dateStyle: "short", timeStyle: "medium" });
  }

  if (records.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>{t("colTime")}</Th>
          <Th>{t("colActor")}</Th>
          <Th>{t("colAction")}</Th>
          <Th>{t("colTarget")}</Th>
          <Th>{t("colDetails")}</Th>
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
                  className="text-xs text-(--color-fg-muted)"
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
                    className="text-xs text-(--color-fg-muted)"
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
              <AuditDetails record={rec} toggleLabel={t("detailsToggle")} />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
