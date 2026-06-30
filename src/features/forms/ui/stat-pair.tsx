// src/features/forms/ui/stat-pair.tsx
export function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-(--color-fg-muted)">{label}: </dt>
      <dd className="inline tabular-nums">{value}</dd>
    </div>
  );
}
