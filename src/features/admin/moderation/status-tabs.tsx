import Link from "next/link";
import type { ModerationStatus } from "@/api/types";

export type Tab = ModerationStatus | "all";

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "На модерации" },
  { value: "published", label: "Опубликованные" },
  { value: "hidden", label: "Скрытые" },
  { value: "all", label: "Все" },
];

interface StatusTabsProps {
  baseHref: string;
  lectureId: string;
  current: Tab;
}

export function StatusTabs({ baseHref, lectureId, current }: StatusTabsProps) {
  const buildHref = (tab: Tab) => {
    const params = new URLSearchParams({ lecture_id: lectureId });
    if (tab !== "pending") params.set("status", tab);
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <nav
      className="flex gap-1 border-b border-(--color-border)"
      aria-label="Фильтр по статусу"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.value}
          href={buildHref(tab.value)}
          aria-current={current === tab.value ? "page" : undefined}
          className={[
            "px-3 py-1.5 text-sm border-b-2",
            current === tab.value
              ? "border-(--color-primary) font-semibold"
              : "border-transparent text-(--color-description)",
          ].join(" ")}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function parseStatusParam(
  raw: string | undefined
): ModerationStatus[] {
  if (raw === undefined) return ["pending"];
  if (raw === "all") return [];
  const valid: ModerationStatus[] = ["published", "hidden", "pending"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ModerationStatus =>
      valid.includes(s as ModerationStatus)
    );
}

export function statusToTab(statuses: ModerationStatus[]): Tab {
  if (statuses.length === 0) return "all";
  const first = statuses[0];
  if (statuses.length === 1 && first !== undefined) return first;
  return "all";
}
