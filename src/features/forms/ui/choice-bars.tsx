// src/features/forms/ui/choice-bars.tsx
import { getT } from "@/i18n";

import type { OptionStat } from "../types";

interface Props {
  options: OptionStat[];
  /** База процента — число заполнивших поле. */
  answered: number;
  /** multi_choice: сумма может быть >100%. */
  multi: boolean;
}

function pct(count: number, answered: number): number {
  if (answered <= 0) return 0;
  return Math.round((count / answered) * 100);
}

export async function ChoiceBars({ options, answered, multi }: Props) {
  const t = await getT("forms");
  return (
    <div className="flex flex-col gap-2">
      {multi && (
        <p className="text-xs text-(--color-fg-muted)">{t("results.multiHint")}</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {options.map((o) => {
          const p = pct(o.count ?? 0, answered);
          return (
            <li key={o.option_id} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate">{o.label}</span>
              {/* CSP-safe: ширина бара через SVG-геометрию (атрибут), не inline-style. */}
              <svg
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                className="h-2 flex-1"
                role="presentation"
                aria-hidden="true"
              >
                <rect x="0" y="0" width="100" height="8" className="fill-(--color-surface-subtle)" />
                <rect x="0" y="0" width={p} height="8" className="fill-(--color-accent)" />
              </svg>
              <span className="w-8 shrink-0 text-end tabular-nums">{o.count ?? 0}</span>
              <span className="w-10 shrink-0 text-end tabular-nums text-(--color-fg-muted)">{p}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
