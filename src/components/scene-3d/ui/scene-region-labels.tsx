"use client";
// src/components/scene-3d/ui/scene-region-labels.tsx
// Presentational: спроецированные подписи регионов/кластеров поверх <canvas>.
export interface ProjectedLabel {
  id: number;
  label: string;
  color: string;
  x: number;
  y: number;
}

export function SceneRegionLabels({ labels }: { labels: ProjectedLabel[] }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {labels.map((l) => (
        <span
          key={l.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium"
          style={{
            left: l.x,
            top: l.y,
            color: l.color,
            background: "color-mix(in oklch, var(--color-surface) 80%, transparent)",
          }}
        >
          {l.label}
        </span>
      ))}
    </div>
  );
}
