// src/components/scene-3d/ui/scene-state-panel.tsx
// Server-компонент: состояние сцены «строится»/«ошибка». i18n-agnostic — тексты приходят пропами.
export function SceneStatePanel({
  reason,
  buildingText,
  errorText,
}: {
  reason: "building" | "error";
  buildingText: string;
  errorText: string;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-(--color-fg-muted)">
      {reason === "building" ? buildingText : errorText}
    </div>
  );
}
