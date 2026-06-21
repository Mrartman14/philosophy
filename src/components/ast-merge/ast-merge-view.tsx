"use client";
import { useMemo, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
// Deep-импорт: модуль normalize tiptap-free, держим его глубоким импортом, чтобы
// не тянуть баррель редактора (@/components/ast-editor) в этот клиентский вьюх.
import { normalizeBlocks } from "@/components/ast-editor/normalize";
import { AstRender } from "@/components/ast-render";
import { Button, Dialog } from "@/components/ui";

import { assembleMerged } from "./assemble-merged";
import { classifyBlocks } from "./classify-blocks";
import {
  CONFLICT_STATUSES,
  isConflict,
  isRemoved,
  type MergeChoice,
  type MergeDecisions,
  type MergeEntry,
  type MergeStatus,
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
  acceptDeletion: string;
  contentChanged: string;
  unchangedLabel: string;
  showUnchanged: string;
  hideUnchanged: string;
  applyButton: string;
  cancelButton: string;
  takeServerButton: string;
}

interface Props {
  base: AstBlock[];
  mine: AstBlock[];
  theirs: AstBlock[];
  labels: MergeViewLabels;
  onApply: (blocks: AstBlock[]) => void;
  onCancel: () => void;
  /** «Отбросить мои правки, взять серверную» — escape hatch. Поведение
   *  (перезагрузка редактора серверной версией) прошивает потребляющая форма. */
  onTakeServer: () => void;
}

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
  onTakeServer,
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
  const [showUnchanged, setShowUnchanged] = useState(false);

  const conflicts = entries.filter((e) => CONFLICT_STATUSES.has(e.status));
  const allDecided = conflicts.every((e) => decisions[e.key]);
  const unchanged = entries.filter((e) => e.status === "unchanged");
  const unchangedN = unchanged.length;
  const visible = entries.filter((e) => e.status !== "unchanged");

  function choose(key: string, choice: MergeChoice) {
    setDecisions((d) => ({ ...d, [key]: choice }));
  }

  // A11y: используем проектный Base UI Dialog (focus-trap, scroll-lock,
  // Escape-to-close, восстановление фокуса) вместо самописного
  // `fixed inset-0 role="dialog"`. ОТКЛОНЕНИЕ от спеки «fullscreen takeover»:
  // Dialog отрисовывается по центру, max-w-lg, скроллящийся — фронт НЕ трогает
  // FROZEN src/components/ui/dialog.tsx ради ширины. A11y-корректность важнее
  // буквального full-screen; здесь расширяем поверхность через className до
  // max-w-3xl + ограничение высоты со скроллом (Dialog className-override открыт).
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={labels.title}
      className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-auto">
        <p className="text-sm text-(--color-fg-muted)">{labels.intro}</p>

        {unchangedN > 0 && (
          <div className="text-sm">
            <button
              type="button"
              className="text-(--color-fg-muted) underline"
              aria-expanded={showUnchanged}
              onClick={() => {
                setShowUnchanged((v) => !v);
              }}
            >
              {(showUnchanged ? labels.hideUnchanged : labels.showUnchanged) +
                " (" +
                String(unchangedN) +
                ")"}
            </button>
            {showUnchanged && (
              <ul className="mt-2 flex flex-col gap-2">
                {unchanged.map((e) => {
                  const block = e.theirs ?? e.mine;
                  return (
                    <li
                      key={e.key}
                      className="rounded border border-(--color-border) p-3 opacity-70"
                    >
                      {block && <AstRender blocks={[block]} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
      </div>

      <footer className="mt-4 flex flex-wrap gap-3">
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
        {/* Tertiary / destructive escape hatch — визуально отделён (ml-auto). */}
        <Button
          type="button"
          variant="ghost"
          className="ml-auto text-(--color-danger-fg)"
          onClick={onTakeServer}
        >
          {labels.takeServerButton}
        </Button>
      </footer>
    </Dialog>
  );
}

/** Один вариант (сторона) конфликта. Если `block` === null — сторона удалила
 *  блок; рендерим явный лейбл «принять удаление», а не пустую карточку. */
function ConflictOption({
  name,
  value,
  sideLabel,
  block,
  baseText,
  acceptDeletionLabel,
  contentChangedLabel,
  checked,
  onChange,
}: {
  name: string;
  value: MergeChoice;
  sideLabel: string;
  block: AstBlock | null;
  baseText: string;
  acceptDeletionLabel: string;
  contentChangedLabel: string;
  checked: boolean;
  onChange: () => void;
}) {
  const inputId = `${name}-${value}`;
  return (
    <div className="flex gap-2">
      <input
        id={inputId}
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
      />
      {/* Видимый <label> охватывает имя стороны И содержимое блока, поэтому
          доступное имя радио не схлопывается до одной «Серверная версия». */}
      <label htmlFor={inputId} className="flex-1">
        <span className="text-xs text-(--color-fg-muted)">{sideLabel}</span>
        {block === null ? (
          <span className="block text-sm italic text-(--color-fg-muted)">
            {acceptDeletionLabel}
          </span>
        ) : (
          <>
            <AstRender blocks={[block]} />
            <SideDiff
              baseText={baseText}
              sideText={block.text ?? ""}
              contentChangedLabel={contentChangedLabel}
            />
          </>
        )}
      </label>
    </div>
  );
}

/** Пословный diff либо, для структурных блоков без текста (image, thematic_break,
 *  …) — индикатор «содержимое изменено» вместо пустого WordDiffView. */
function SideDiff({
  baseText,
  sideText,
  contentChangedLabel,
}: {
  baseText: string;
  sideText: string;
  contentChangedLabel: string;
}) {
  // Оба текста пусты → блок различается только attrs (картинка/разделитель):
  // wordDiff дал бы пустоту, показываем явный индикатор.
  if (baseText === "" && sideText === "") {
    return (
      <span className="text-xs italic text-(--color-fg-muted)">
        {contentChangedLabel}
      </span>
    );
  }
  return <WordDiffView tokens={wordDiff(baseText, sideText)} />;
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

  if (isConflict(entry.status)) {
    return (
      <div className="rounded border border-(--color-border) p-3">
        <p className="mb-2 text-sm font-medium text-red-600">
          {labels.conflictHeading}
        </p>
        {/* Радиогруппа с доступным именем, привязанным к заголовку конфликта. */}
        <div
          role="radiogroup"
          aria-label={labels.conflictHeading}
          className="flex flex-col gap-2"
        >
          <ConflictOption
            name={entry.key}
            value="theirs"
            sideLabel={labels.optionServer}
            block={entry.theirs}
            baseText={baseText}
            acceptDeletionLabel={labels.acceptDeletion}
            contentChangedLabel={labels.contentChanged}
            checked={choice === "theirs"}
            onChange={() => {
              onChoose("theirs");
            }}
          />
          <ConflictOption
            name={entry.key}
            value="mine"
            sideLabel={labels.optionMine}
            block={entry.mine}
            baseText={baseText}
            acceptDeletionLabel={labels.acceptDeletion}
            contentChangedLabel={labels.contentChanged}
            checked={choice === "mine"}
            onChange={() => {
              onChoose("mine");
            }}
          />
        </div>
      </div>
    );
  }

  const block = entry.theirs ?? entry.mine;
  const badge = badgeFor(entry.status, labels);
  const removed = isRemoved(entry.status);

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
          <SideDiff
            baseText={baseText}
            sideText={entry.theirs.text ?? ""}
            contentChangedLabel={labels.contentChanged}
          />
        )}
      </div>
    </div>
  );
}
