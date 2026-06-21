"use client";
import { useMemo, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
// Deep-импорт: модуль normalize tiptap-free, держим его глубоким импортом, чтобы
// не тянуть баррель редактора (@/components/ast-editor) в этот клиентский вьюх.
import { normalizeBlocks } from "@/components/ast-editor/normalize";
import { AstRender } from "@/components/ast-render";
import { Button } from "@/components/ui";

import { assembleMerged } from "./assemble-merged";
import { classifyBlocks } from "./classify-blocks";
import type {
  MergeChoice,
  MergeDecisions,
  MergeEntry,
  MergeStatus,
} from "./types";
import { wordDiff } from "./word-diff";
import { WordDiffView } from "./word-diff-view";

/** Плоский набор локализованных строк — компонент i18n-агностичен, строки
 *  приходят пропом из потребляющей формы (namespace сущности). */
export interface MergeViewLabels {
  title: string;
  intro: string;
  badgeServerChanged: string;
  badgeYourEdit: string;
  badgeAddedByYou: string;
  badgeAddedOnServer: string;
  badgeRemovedByYou: string;
  badgeRemovedOnServer: string;
  conflictHeading: string;
  optionServer: string;
  optionMine: string;
  unchangedLabel: string;
  applyButton: string;
  cancelButton: string;
}

interface Props {
  base: AstBlock[];
  mine: AstBlock[];
  theirs: AstBlock[];
  labels: MergeViewLabels;
  onApply: (blocks: AstBlock[]) => void;
  onCancel: () => void;
}

const CONFLICT: ReadonlySet<MergeStatus> = new Set([
  "conflict",
  "structural-conflict",
]);

function badgeFor(status: MergeStatus, l: MergeViewLabels): string | null {
  switch (status) {
    case "server-only":
      return l.badgeServerChanged;
    case "mine-only":
      return l.badgeYourEdit;
    case "added-mine":
      return l.badgeAddedByYou;
    case "added-server":
      return l.badgeAddedOnServer;
    case "removed-mine":
      return l.badgeRemovedByYou;
    case "removed-server":
      return l.badgeRemovedOnServer;
    default:
      return null;
  }
}

export function AstMergeView({
  base: rawBase,
  mine: rawMine,
  theirs: rawTheirs,
  labels,
  onApply,
  onCancel,
}: Props) {
  // Нормализуем все три набора в каноническую редакторную форму перед classify+diff:
  // base/theirs приходят серверной формой (произвольный порядок ключей, без `text`),
  // mine — из сериализатора редактора. Без нормализации даже нетронутый блок выходит
  // неравным → ложный mine-only/conflict → серверная правка предлагается к отбросу
  // (потеря данных). См. normalize-classify.test.ts.
  const base = useMemo(() => normalizeBlocks(rawBase), [rawBase]);
  const mine = useMemo(() => normalizeBlocks(rawMine), [rawMine]);
  const theirs = useMemo(() => normalizeBlocks(rawTheirs), [rawTheirs]);

  const entries = useMemo(
    () => classifyBlocks(base, mine, theirs),
    [base, mine, theirs],
  );
  const [decisions, setDecisions] = useState<MergeDecisions>({});

  const conflicts = entries.filter((e) => CONFLICT.has(e.status));
  const allDecided = conflicts.every((e) => decisions[e.key]);
  const unchangedN = entries.filter((e) => e.status === "unchanged").length;
  const visible = entries.filter((e) => e.status !== "unchanged");

  function choose(key: string, choice: MergeChoice) {
    setDecisions((d) => ({ ...d, [key]: choice }));
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-(--color-surface) p-6"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header>
          <h2 className="text-lg font-semibold">{labels.title}</h2>
          <p className="text-sm text-(--color-fg-muted)">{labels.intro}</p>
        </header>

        {unchangedN > 0 && (
          <p className="text-sm text-(--color-fg-muted)">
            {unchangedN} {labels.unchangedLabel}
          </p>
        )}

        <ol className="flex flex-col gap-4">
          {visible.map((e) => (
            <li key={e.key}>
              <EntryView
                entry={e}
                labels={labels}
                choice={decisions[e.key]}
                onChoose={(c) => {
                  choose(e.key, c);
                }}
              />
            </li>
          ))}
        </ol>

        <footer className="sticky bottom-0 flex gap-3 bg-(--color-surface) py-3">
          <Button
            type="button"
            disabled={!allDecided}
            onClick={() => {
              onApply(assembleMerged(entries, decisions));
            }}
          >
            {labels.applyButton}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {labels.cancelButton}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function EntryView({
  entry,
  labels,
  choice,
  onChoose,
}: {
  entry: MergeEntry;
  labels: MergeViewLabels;
  choice: MergeChoice | undefined;
  onChoose: (c: MergeChoice) => void;
}) {
  const baseText = entry.base?.text ?? "";

  if (CONFLICT.has(entry.status)) {
    return (
      <div className="rounded border border-(--color-border) p-3">
        <p className="mb-2 text-sm font-medium text-red-600">
          {labels.conflictHeading}
        </p>
        <label className="mb-2 flex gap-2">
          <input
            type="radio"
            name={entry.key}
            aria-label={labels.optionServer}
            checked={choice === "theirs"}
            onChange={() => {
              onChoose("theirs");
            }}
          />
          <div>
            <span className="text-xs text-(--color-fg-muted)">
              {labels.optionServer}
            </span>
            {entry.theirs && <AstRender blocks={[entry.theirs]} />}
            {entry.theirs && (
              <WordDiffView
                tokens={wordDiff(baseText, entry.theirs.text ?? "")}
              />
            )}
          </div>
        </label>
        <label className="flex gap-2">
          <input
            type="radio"
            name={entry.key}
            aria-label={labels.optionMine}
            checked={choice === "mine"}
            onChange={() => {
              onChoose("mine");
            }}
          />
          <div>
            <span className="text-xs text-(--color-fg-muted)">
              {labels.optionMine}
            </span>
            {entry.mine && <AstRender blocks={[entry.mine]} />}
            {entry.mine && (
              <WordDiffView
                tokens={wordDiff(baseText, entry.mine.text ?? "")}
              />
            )}
          </div>
        </label>
      </div>
    );
  }

  const block = entry.theirs ?? entry.mine;
  const badge = badgeFor(entry.status, labels);
  const removed =
    entry.status === "removed-mine" || entry.status === "removed-server";

  return (
    <div className="rounded border border-(--color-border) p-3">
      {badge && (
        <span className="mb-1 inline-block text-xs text-(--color-fg-muted)">
          {badge}
        </span>
      )}
      <div className={removed ? "line-through opacity-50" : undefined}>
        {block && <AstRender blocks={[block]} />}
        {entry.status === "server-only" && entry.theirs && (
          <WordDiffView tokens={wordDiff(baseText, entry.theirs.text ?? "")} />
        )}
      </div>
    </div>
  );
}
