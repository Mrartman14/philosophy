// src/components/ui/chip.ts

/**
 * Returns the CSS class string for a border-pill chip element.
 * Pass `interactive: true` to include the hover background utility.
 */
export function chipClass(opts?: { interactive?: boolean }): string {
  const base =
    "rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-fg-muted)";
  return opts?.interactive
    ? `${base} hover:bg-(--color-surface-subtle)`
    : base;
}
